import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

export interface ParsedSlot {
  start: string
  end: string
  status: 'available' | 'unavailable'
}

export const parseAvailabilityText = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      text: string
      eventDateStart: string
      eventDateEnd: string
      participantTimezone: string
    }) => input,
  )
  .handler(async ({ data }) => {
    const today = new Date().toISOString().split('T')[0]

    const response = (await env.AI.run(
      '@cf/meta/llama-3.1-8b-instruct',
      {
        messages: [
          {
            role: 'system',
            content: `You are a date/time parser. Given natural language text about someone's availability, extract structured time slots.

Context:
- Today's date: ${today}
- Event possible date range: ${data.eventDateStart} to ${data.eventDateEnd}
- Participant's timezone: ${data.participantTimezone}

Rules:
- Output ONLY a JSON array of objects with: { "start": "ISO8601_UTC", "end": "ISO8601_UTC", "status": "available" | "unavailable" }
- Convert all times to UTC based on the participant's timezone
- "오후 가능" without specific hours → 13:00-18:00 local
- "오전" without specific hours → 09:00-12:00 local
- "저녁" without specific hours → 18:00-22:00 local
- "하루종일" → 09:00-22:00 local
- Default to "available" unless explicitly unavailable (안돼, 불가능, 못 함 등)
- Only include slots within the event date range
- No explanation, no markdown, just the JSON array`,
          },
          {
            role: 'user',
            content: data.text,
          },
        ],
      },
    )) as { response?: string }

    const content = response.response ?? ''

    const jsonStr = content
      .replace(/```json?\n?/g, '')
      .replace(/```/g, '')
      .trim()
    return JSON.parse(jsonStr) as ParsedSlot[]
  })
