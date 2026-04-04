import { eq, and, lte } from 'drizzle-orm'
import { getDb } from '../../db'
import { events, participants, availabilitySlots } from '../../db/schema'
import { findOptimalTime } from '../../lib/optimal-time'
import { nowUTC } from '../../lib/time'

/**
 * Cron Trigger 핸들러: 응답 기한이 지난 pending 이벤트를 자동 확정한다.
 * wrangler.jsonc의 `triggers.crons`에 의해 5분마다 실행.
 */
export async function checkDeadlines(d1: D1Database) {
  const db = getDb(d1)
  const now = nowUTC()

  // 응답 기한이 지났지만 아직 pending인 이벤트 조회
  const expiredEvents = await db.query.events.findMany({
    where: and(eq(events.status, 'pending'), lte(events.responseDeadlineAt, now)),
  })

  for (const event of expiredEvents) {
    const allSlots = await db.query.availabilitySlots.findMany({
      where: eq(availabilitySlots.eventId, event.id),
    })

    const allParticipants = await db.query.participants.findMany({
      where: eq(participants.eventId, event.id),
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

    const meetsMinimum =
      !event.minParticipants ||
      (optimal && optimal.availableCount >= event.minParticipants)

    if (optimal && meetsMinimum) {
      await db
        .update(events)
        .set({
          status: 'confirmed',
          confirmedStart: optimal.start,
          confirmedEnd: optimal.end,
          updatedAt: now,
        })
        .where(eq(events.id, event.id))
    } else {
      await db
        .update(events)
        .set({
          status: 'cancelled',
          updatedAt: now,
        })
        .where(eq(events.id, event.id))
    }
  }

  return { processed: expiredEvents.length }
}
