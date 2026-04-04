import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { eq, and } from 'drizzle-orm'
import { getDb } from '../../db'
import { events, participants, availabilitySlots } from '../../db/schema'
import { generateEventId, generateAdminToken } from '../../lib/tokens'
import { nowUTC } from '../../lib/time'

export const createEvent = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      title: string
      description?: string
      durationMinutes: number
      timezone: string
      eventDateStart: string
      eventDateEnd: string
      responseDeadlineAt: string
    }) => input,
  )
  .handler(async ({ data }) => {
    const db = getDb(env.DB)
    const eventId = generateEventId()
    const adminToken = generateAdminToken()

    await db.insert(events).values({
      id: eventId,
      title: data.title,
      description: data.description,
      durationMinutes: data.durationMinutes,
      adminToken,
      timezone: data.timezone,
      eventDateStart: data.eventDateStart,
      eventDateEnd: data.eventDateEnd,
      responseDeadlineAt: data.responseDeadlineAt,
    })

    return { eventId, adminToken }
  })

export const getEvent = createServerFn({ method: 'GET' })
  .inputValidator((input: { eventId: string }) => input)
  .handler(async ({ data }) => {
    const db = getDb(env.DB)

    const event = await db.query.events.findFirst({
      where: eq(events.id, data.eventId),
    })
    if (!event) throw new Error('Event not found')

    const eventParticipants = await db.query.participants.findMany({
      where: eq(participants.eventId, data.eventId),
    })

    return {
      ...event,
      participants: eventParticipants.map((p) => ({
        id: p.id,
        name: p.name,
        respondedAt: p.respondedAt,
        timezone: p.timezone,
      })),
    }
  })

export const getEventByAdminToken = createServerFn({ method: 'GET' })
  .inputValidator((input: { adminToken: string }) => input)
  .handler(async ({ data }) => {
    const db = getDb(env.DB)

    const event = await db.query.events.findFirst({
      where: eq(events.adminToken, data.adminToken),
    })
    if (!event) throw new Error('Event not found')

    const eventParticipants = await db.query.participants.findMany({
      where: eq(participants.eventId, event.id),
    })

    return {
      ...event,
      participants: eventParticipants.map((p) => ({
        id: p.id,
        name: p.name,
        respondedAt: p.respondedAt,
        timezone: p.timezone,
      })),
    }
  })

export const confirmEvent = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      eventId: string
      adminToken: string
    }) => input,
  )
  .handler(async ({ data }) => {
    const db = getDb(env.DB)

    const event = await db.query.events.findFirst({
      where: and(
        eq(events.id, data.eventId),
        eq(events.adminToken, data.adminToken),
      ),
    })
    if (!event) throw new Error('Event not found or unauthorized')

    // 최적 시간 계산
    const { findOptimalTime } = await import('../../lib/optimal-time')
    const allSlots = await db.query.availabilitySlots.findMany({
      where: eq(availabilitySlots.eventId, data.eventId),
    })
    const allParticipants = await db.query.participants.findMany({
      where: eq(participants.eventId, data.eventId),
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

    if (!optimal) throw new Error('참여 가능한 공통 시간을 찾을 수 없습니다.')

    await db
      .update(events)
      .set({
        status: 'confirmed',
        confirmedStart: optimal.start,
        confirmedEnd: optimal.end,
        updatedAt: nowUTC(),
      })
      .where(eq(events.id, data.eventId))

    return { success: true, optimal }
  })

export const updateEvent = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      eventId: string
      adminToken: string
      title?: string
      description?: string
      durationMinutes?: number
      eventDateStart?: string
      eventDateEnd?: string
      responseDeadlineAt?: string
    }) => input,
  )
  .handler(async ({ data }) => {
    const db = getDb(env.DB)

    const event = await db.query.events.findFirst({
      where: and(
        eq(events.id, data.eventId),
        eq(events.adminToken, data.adminToken),
      ),
    })
    if (!event) throw new Error('Event not found or unauthorized')
    if (event.status !== 'pending') throw new Error('확정/취소된 일정은 수정할 수 없습니다.')

    const updates: Record<string, unknown> = { updatedAt: nowUTC() }
    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description
    if (data.durationMinutes !== undefined) updates.durationMinutes = data.durationMinutes
    if (data.eventDateStart !== undefined) updates.eventDateStart = data.eventDateStart
    if (data.eventDateEnd !== undefined) updates.eventDateEnd = data.eventDateEnd
    if (data.responseDeadlineAt !== undefined) updates.responseDeadlineAt = data.responseDeadlineAt

    await db.update(events).set(updates).where(eq(events.id, data.eventId))

    return { success: true }
  })
