import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    durationMinutes: integer('duration_minutes').notNull().default(60),
    adminToken: text('admin_token').notNull().unique(),
    timezone: text('timezone').notNull(),
    eventDateStart: text('event_date_start').notNull(),
    eventDateEnd: text('event_date_end').notNull(),
    responseDeadlineAt: text('response_deadline_at').notNull(),
    minParticipants: integer('min_participants'),
    status: text('status', {
      enum: ['pending', 'confirmed', 'cancelled'],
    })
      .notNull()
      .default('pending'),
    confirmedStart: text('confirmed_start'),
    confirmedEnd: text('confirmed_end'),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('idx_events_status_deadline').on(
      table.status,
      table.responseDeadlineAt,
    ),
  ],
)

export const participants = sqliteTable(
  'participants',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    timezone: text('timezone'),
    respondedAt: text('responded_at'),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('idx_participants_event').on(table.eventId),
    index('idx_participants_event_name').on(table.eventId, table.name),
  ],
)

export const availabilitySlots = sqliteTable(
  'availability_slots',
  {
    id: text('id').primaryKey(),
    participantId: text('participant_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    startAt: text('start_at').notNull(),
    endAt: text('end_at').notNull(),
    status: text('status', {
      enum: ['available', 'unavailable'],
    })
      .notNull()
      .default('available'),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('idx_slots_participant').on(table.participantId),
    index('idx_slots_event').on(table.eventId),
  ],
)
