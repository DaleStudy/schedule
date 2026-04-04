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
      '@cf/meta/llama-3.1-8b-instruct-fast',
      {
        max_tokens: 2048,
        messages: [
          {
            role: 'system',
            content: `You parse natural language availability into JSON. Output ONLY a JSON array, nothing else.

Format: [{"start":"ISO8601_UTC","end":"ISO8601_UTC","status":"available"}]

Context: today=${today}, range=${data.eventDateStart} to ${data.eventDateEnd}, timezone=${data.participantTimezone}

Time defaults (local): 오전=09:00-12:00, 오후=13:00-18:00, 저녁=18:00-22:00, 하루종일=09:00-22:00
Convert to UTC. "available" unless explicitly unavailable (안돼/불가능/못).
Output ONLY the JSON array. No explanation.`,
          },
          {
            role: 'user',
            content: data.text,
          },
        ],
      },
    )) as { response?: string }

    const content = response.response ?? ''

    // JSON 배열 추출: 첫 번째 [ 부터 마지막 ] 까지
    const startIdx = content.indexOf('[')
    const endIdx = content.lastIndexOf(']')
    if (startIdx === -1 || endIdx === -1) {
      throw new Error('AI 응답에서 JSON을 찾을 수 없습니다. 다시 시도해주세요.')
    }

    const jsonStr = content.slice(startIdx, endIdx + 1)

    try {
      return JSON.parse(jsonStr) as ParsedSlot[]
    } catch {
      throw new Error(
        '시간 분석 결과를 파싱할 수 없습니다. 다시 시도해주세요.',
      )
    }
  })
