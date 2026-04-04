import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { dayjs } from '../../lib/time'

export interface ParsedSlot {
  start: string
  end: string
  status: 'available' | 'unavailable'
}

interface LocalSlot {
  date: string
  startTime: string
  endTime: string
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

    // 이벤트 날짜 범위의 각 날짜와 요일을 계산해서 AI에 제공
    const dates: string[] = []
    let cursor = dayjs.utc(data.eventDateStart).tz(data.participantTimezone)
    const end = dayjs.utc(data.eventDateEnd).tz(data.participantTimezone)
    while (!cursor.isAfter(end)) {
      const dow = ['일', '월', '화', '수', '목', '금', '토'][cursor.day()]
      dates.push(`${cursor.format('YYYY-MM-DD')}(${dow})`)
      cursor = cursor.add(1, 'day')
    }

    const response = (await env.AI.run(
      '@cf/meta/llama-3.1-8b-instruct-fast',
      {
        max_tokens: 2048,
        messages: [
          {
            role: 'system',
            content: `You extract availability from Korean text into JSON. Output ONLY a JSON array.

Format: [{"date":"YYYY-MM-DD","startTime":"HH:mm","endTime":"HH:mm","status":"available"|"unavailable"}]

Available dates: ${dates.join(', ')}
Today: ${today}

Rules:
- Output LOCAL times, NOT UTC
- 오전=09:00-12:00, 오후=13:00-18:00, 저녁=18:00-22:00, 하루종일=09:00-22:00
- 주말=Saturday+Sunday, 평일=Monday-Friday
- "안됨/불가/못" → status:"unavailable"
- For unavailable days, use startTime:"09:00", endTime:"22:00"
- Include BOTH available AND unavailable slots
- Output ONLY the JSON array`,
          },
          {
            role: 'user',
            content: data.text,
          },
        ],
      },
    )) as { response?: string }

    const content = response.response ?? ''

    const startIdx = content.indexOf('[')
    const endIdx = content.lastIndexOf(']')
    if (startIdx === -1 || endIdx === -1) {
      throw new Error(
        'AI 응답에서 JSON을 찾을 수 없습니다. 다시 시도해주세요.',
      )
    }

    const jsonStr = content.slice(startIdx, endIdx + 1)
    let localSlots: LocalSlot[]
    try {
      localSlots = JSON.parse(jsonStr)
    } catch {
      throw new Error(
        '시간 분석 결과를 파싱할 수 없습니다. 다시 시도해주세요.',
      )
    }

    // 현지 시간 → UTC 변환
    return localSlots.map((slot) => ({
      start: dayjs
        .tz(`${slot.date} ${slot.startTime}`, data.participantTimezone)
        .utc()
        .toISOString(),
      end: dayjs
        .tz(`${slot.date} ${slot.endTime}`, data.participantTimezone)
        .utc()
        .toISOString(),
      status: slot.status,
    })) as ParsedSlot[]
  })
