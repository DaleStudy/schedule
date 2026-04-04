import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { eq, and } from 'drizzle-orm'
import { getDb } from '../../db'
import { events, participants, availabilitySlots } from '../../db/schema'
import { generateEventId, generateSlotId } from '../../lib/tokens'
import { nowUTC } from '../../lib/time'

export const submitAvailability = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      eventId: string
      name: string
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

    const event = await db.query.events.findFirst({
      where: eq(events.id, data.eventId),
    })
    if (!event) throw new Error('Event not found')
    if (event.status !== 'pending')
      throw new Error('Event is no longer accepting responses')

    // 같은 이름의 기존 참여자 조회 (재응답 지원)
    let participant = await db.query.participants.findFirst({
      where: and(
        eq(participants.eventId, data.eventId),
        eq(participants.name, data.name),
      ),
    })

    if (participant) {
      // 기존 슬롯 삭제
      await db
        .delete(availabilitySlots)
        .where(eq(availabilitySlots.participantId, participant.id))
      // 참여자 정보 업데이트
      await db
        .update(participants)
        .set({ timezone: data.timezone, respondedAt: nowUTC() })
        .where(eq(participants.id, participant.id))
    } else {
      // 새 참여자 생성
      const participantId = generateEventId()
      await db.insert(participants).values({
        id: participantId,
        eventId: data.eventId,
        name: data.name,
        timezone: data.timezone,
        respondedAt: nowUTC(),
      })
      participant = { id: participantId } as typeof participant
    }

    // D1 바인딩 파라미터 제한(100개)을 피하기 위해 10개씩 배치 삽입
    const BATCH_SIZE = 10
    for (let i = 0; i < data.slots.length; i += BATCH_SIZE) {
      const batch = data.slots.slice(i, i + BATCH_SIZE)
      await db.insert(availabilitySlots).values(
        batch.map((slot) => ({
          id: generateSlotId(),
          participantId: participant!.id,
          eventId: data.eventId,
          startAt: slot.startAt,
          endAt: slot.endAt,
          status: slot.status,
        })),
      )
    }

    return { success: true }
  })
