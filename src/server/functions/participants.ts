import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { eq, and, count } from 'drizzle-orm'
import { getDb } from '../../db'
import {
  events,
  participants,
  availabilitySlots,
} from '../../db/schema'
import { generateSlotId } from '../../lib/tokens'
import { nowUTC } from '../../lib/time'
import { findOptimalTime } from '../../lib/optimal-time'

export const getParticipantByToken = createServerFn({ method: 'GET' })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const db = getDb(env.DB)

    const participant = await db.query.participants.findFirst({
      where: eq(participants.token, data.token),
    })
    if (!participant) throw new Error('Participant not found')

    const event = await db.query.events.findFirst({
      where: eq(events.id, participant.eventId),
    })
    if (!event) throw new Error('Event not found')

    const existingSlots = await db.query.availabilitySlots.findMany({
      where: eq(availabilitySlots.participantId, participant.id),
    })

    return { participant, event, existingSlots }
  })

export const submitAvailability = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      participantToken: string
      timezone: string
      slots: Array<{
        startAt: string
        endAt: string
        status: 'available' | 'unavailable'
      }>
    }) => input,
  )
  .handler(async ({ data }) => {
    const db = getDb(env.DB)

    const participant = await db.query.participants.findFirst({
      where: eq(participants.token, data.participantToken),
    })
    if (!participant) throw new Error('Participant not found')

    const event = await db.query.events.findFirst({
      where: eq(events.id, participant.eventId),
    })
    if (!event) throw new Error('Event not found')
    if (event.status !== 'pending') throw new Error('Event is no longer accepting responses')

    // 기존 슬롯 삭제 후 새로 삽입 (재응답 지원)
    await db
      .delete(availabilitySlots)
      .where(eq(availabilitySlots.participantId, participant.id))

    if (data.slots.length > 0) {
      await db.insert(availabilitySlots).values(
        data.slots.map((slot) => ({
          id: generateSlotId(),
          participantId: participant.id,
          eventId: participant.eventId,
          startAt: slot.startAt,
          endAt: slot.endAt,
          status: slot.status,
        })),
      )
    }

    // 참여자 정보 업데이트
    await db
      .update(participants)
      .set({ timezone: data.timezone, respondedAt: nowUTC() })
      .where(eq(participants.id, participant.id))

    // 전원 응답 여부 확인 → 자동 확정 트리거
    const allParticipants = await db.query.participants.findMany({
      where: eq(participants.eventId, participant.eventId),
    })
    const totalCount = allParticipants.length
    const respondedCount = allParticipants.filter((p) => p.respondedAt).length

    if (respondedCount >= totalCount) {
      await autoConfirmEvent(participant.eventId)
    }

    return { success: true, allResponded: respondedCount >= totalCount }
  })

async function autoConfirmEvent(eventId: string) {
  const db = getDb(env.DB)

  const event = await db.query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.status, 'pending')),
  })
  if (!event) return

  const allSlots = await db.query.availabilitySlots.findMany({
    where: eq(availabilitySlots.eventId, eventId),
  })

  const allParticipants = await db.query.participants.findMany({
    where: eq(participants.eventId, eventId),
  })

  const optimal = findOptimalTime(
    allSlots.map((s) => ({
      participantId: s.participantId,
      startAt: s.startAt,
      endAt: s.endAt,
      status: s.status as 'available' | 'unavailable',
    })),
    event.durationMinutes,
    event.eventDateStart,
    event.eventDateEnd,
    allParticipants.length,
  )

  if (optimal) {
    await db
      .update(events)
      .set({
        status: 'confirmed',
        confirmedStart: optimal.start,
        confirmedEnd: optimal.end,
        updatedAt: nowUTC(),
      })
      .where(eq(events.id, eventId))
  }
}
