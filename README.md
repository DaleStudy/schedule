# Schedule

Group meeting scheduler with automatic optimal time confirmation.

**Live:** https://schedule.dalestudy.com

## Features

- **Dual deadlines** — response deadline + event date range, so participants have time to check the confirmed schedule
- **Natural language input** — type availability in Korean (e.g., "다음주 화목 오후 2-6시 가능"), powered by Workers AI (Llama)
- **Calendar grid** — drag-select 30-min slots with timezone support
- **Auto-confirmation** — optimal time is confirmed when all respond or the deadline passes
- **Link-based auth** — no login required, share unique URLs per participant

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | TanStack Start |
| UI | Tailwind CSS v4 |
| Database | Cloudflare D1 (SQLite) |
| ORM | Drizzle ORM |
| AI | Cloudflare Workers AI (Llama) |
| Cron | Cloudflare Cron Triggers |
| Runtime | Cloudflare Workers |

## Getting Started

```bash
bun install
bun run db:migrate:local
bun run dev
```

## Deployment

```bash
bun run deploy
```

Or push to `main` — Cloudflare Builds auto-deploys.

## Project Structure

```
src/
  db/           schema, D1 client
  lib/          optimal-time algorithm, time utils, token generation
  server/       server functions (events, participants, NLP parsing), cron handler
  components/   time grid, timezone selector
  routes/       pages (create, respond, admin, public status)
```
