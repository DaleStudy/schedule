# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # Dev server on port 3000
bun run build        # Production build
bun run test         # Typecheck (tsc --noEmit) + run tests
bun run deploy       # Build + wrangler deploy
bun run cf-typegen   # Regenerate worker-configuration.d.ts after wrangler.jsonc changes
bun run db:generate  # Generate Drizzle migration from schema changes
bun run db:migrate:local   # Apply migrations to local D1
bun run db:migrate:remote  # Apply migrations to remote D1
```

## Architecture

**TanStack Start** full-stack React app on **Cloudflare Workers**. D1 (SQLite) for storage, Workers AI (Gemma) for Korean NLP, Cron Triggers for deadline auto-confirmation.

### Data flow
1. Organizer creates event at `/new` → gets admin URL + shared respond URL
2. Participants visit `/{eventId}`, identify with email+name, input availability via NL or calendar grid
3. Cron runs every 5 min → finds expired pending events → runs optimal-time algorithm → confirms or cancels

### Server functions
Use `createServerFn` from `@tanstack/react-start` with `.inputValidator()` (not `.validator()`). Access Cloudflare bindings via `import { env } from 'cloudflare:workers'` — `env.DB` for D1, `env.AI` for Workers AI.

### Time handling
All dates stored as **UTC ISO strings**. Convert with `dayjs.utc()` and `.tz(timezone)`. Cell keys in the calendar grid use `H:mm` format (no zero-padding) — must be consistent everywhere or pre-10am cells break.

### Routing
File-based: `src/routes/$eventId/index.tsx` → `/{eventId}`. Admin pages use `?token=` query param for auth. Route params via `Route.useLoaderData()`, search params via `Route.useSearch()`.

## Key Gotchas

- **D1 parameter limit (~100)**: Batch inserts in chunks of 10. See `submitAvailability` in `participants.ts`.
- **Time format consistency**: Calendar grid cell keys use `"YYYY-MM-DD H:mm"` (single-digit hours). Using `HH:mm` anywhere breaks cells before 10am.
- **Drizzle column references**: When querying participants/slots, use `eq(participants.eventId, ...)` not `eq(events.id, ...)`. TypeScript won't catch this since both are `text` columns. Tests in `events.test.ts` guard against this.
- **Migration NOT NULL columns**: SQLite can't add NOT NULL columns without defaults to existing tables. Add `DEFAULT ''` in migration SQL when needed.
- **`createServerFn` API**: The method is `.inputValidator()`, not `.validator()`. This changed in TanStack Start v1.167+.
