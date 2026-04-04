import { describe, it, expect, beforeEach } from 'vitest'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { eq } from 'drizzle-orm'
import * as schema from '../../db/schema'

const { events, participants, availabilitySlots } = schema

function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE events (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      admin_token TEXT NOT NULL UNIQUE,
      timezone TEXT NOT NULL,
      event_date_start TEXT NOT NULL,
      event_date_end TEXT NOT NULL,
      response_deadline_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      confirmed_start TEXT,
      confirmed_end TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE participants (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      timezone TEXT,
      responded_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE availability_slots (
      id TEXT PRIMARY KEY NOT NULL,
      participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      created_at TEXT NOT NULL
    );
  `)
  return drizzle(sqlite, { schema })
}

function seedEvent(db: ReturnType<typeof createTestDb>, id: string) {
  const now = new Date().toISOString()
  db.insert(events).values({
    id,
    title: 'Test Event',
    adminToken: `admin-${id}`,
    timezone: 'Asia/Seoul',
    eventDateStart: '2026-04-14T00:00:00Z',
    eventDateEnd: '2026-04-20T00:00:00Z',
    responseDeadlineAt: '2026-04-10T00:00:00Z',
    createdAt: now,
    updatedAt: now,
  }).run()
}

function seedParticipant(
  db: ReturnType<typeof createTestDb>,
  id: string,
  eventId: string,
  name: string,
) {
  db.insert(participants).values({
    id,
    eventId,
    name,
    timezone: 'Asia/Seoul',
    respondedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }).run()
}

function seedSlot(
  db: ReturnType<typeof createTestDb>,
  id: string,
  participantId: string,
  eventId: string,
) {
  db.insert(availabilitySlots).values({
    id,
    participantId,
    eventId,
    startAt: '2026-04-15T05:00:00Z',
    endAt: '2026-04-15T07:00:00Z',
    status: 'available',
    createdAt: new Date().toISOString(),
  }).run()
}

describe('이벤트 참여자 조회', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
    seedEvent(db, 'event-1')
    seedEvent(db, 'event-2')
    seedParticipant(db, 'p1', 'event-1', '달레')
    seedParticipant(db, 'p2', 'event-1', '샘')
    seedParticipant(db, 'p3', 'event-2', '에반')
  })

  it('participants.eventId로 조회하면 해당 이벤트 참여자만 반환', () => {
    const result = db.select().from(participants).where(eq(participants.eventId, 'event-1')).all()
    expect(result).toHaveLength(2)
    expect(result.map((p) => p.name).sort()).toEqual(['달레', '샘'])
  })

  it('다른 이벤트 참여자가 섞이지 않음', () => {
    const result = db.select().from(participants).where(eq(participants.eventId, 'event-2')).all()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('에반')
  })

  it('존재하지 않는 이벤트 ID로 조회하면 빈 배열', () => {
    const result = db.select().from(participants).where(eq(participants.eventId, 'nonexistent')).all()
    expect(result).toHaveLength(0)
  })

  it('잘못된 컬럼(events.id)으로 participants를 조회하면 에러 발생', () => {
    expect(() =>
      db.select().from(participants).where(eq(events.id, 'event-1')).all()
    ).toThrow()
  })
})

describe('가용시간 슬롯 조회', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
    seedEvent(db, 'event-1')
    seedEvent(db, 'event-2')
    seedParticipant(db, 'p1', 'event-1', '달레')
    seedParticipant(db, 'p2', 'event-2', '샘')
    seedSlot(db, 's1', 'p1', 'event-1')
    seedSlot(db, 's2', 'p1', 'event-1')
    seedSlot(db, 's3', 'p2', 'event-2')
  })

  it('availabilitySlots.eventId로 조회하면 해당 이벤트 슬롯만 반환', () => {
    const result = db.select().from(availabilitySlots).where(eq(availabilitySlots.eventId, 'event-1')).all()
    expect(result).toHaveLength(2)
  })

  it('다른 이벤트 슬롯이 섞이지 않음', () => {
    const result = db.select().from(availabilitySlots).where(eq(availabilitySlots.eventId, 'event-2')).all()
    expect(result).toHaveLength(1)
  })
})
