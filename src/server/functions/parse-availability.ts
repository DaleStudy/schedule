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

// response_format forces the model to emit output matching this schema,
// which removes the need to strip markdown fences and guarantees a parseable
// shape. Top-level must be an object (arrays aren't allowed), so slots are
// wrapped. Gemma 4 is a reasoning model, so enable_thinking:false is required
// alongside this — otherwise the thinking phase exhausts the token budget
// before any schema-conforming answer is produced.
const AVAILABILITY_SCHEMA = {
  type: 'object',
  properties: {
    slots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          status: { type: 'string', enum: ['available', 'unavailable'] },
        },
        required: ['date', 'startTime', 'endTime', 'status'],
      },
    },
  },
  required: ['slots'],
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

    const dates: string[] = []
    let cursor = dayjs.utc(data.eventDateStart).tz(data.participantTimezone)
    const end = dayjs.utc(data.eventDateEnd).tz(data.participantTimezone)
    while (!cursor.isAfter(end)) {
      const dow = ['일', '월', '화', '수', '목', '금', '토'][cursor.day()]
      dates.push(`${cursor.format('YYYY-MM-DD')}(${dow})`)
      cursor = cursor.add(1, 'day')
    }

    const response = (await env.AI.run(
      '@cf/google/gemma-4-26b-a4b-it',
      {
        max_tokens: 2048,
        // Disable Gemma 4's reasoning phase; without this the model burns the
        // entire token budget thinking and returns empty content.
        chat_template_kwargs: { enable_thinking: false },
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'availability', schema: AVAILABILITY_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: `당신은 일정 파서입니다. 사용자의 가용 시간을 slots 배열로 변환하세요.

가능한 날짜 목록: ${dates.join(', ')}
오늘: ${today}

사용자 입력: "${data.text}"

규칙:
- 사용자가 명시적으로 언급한 날짜/시간만 출력하세요
- 언급하지 않은 날짜는 출력하지 마세요
- 화=화요일, 목=목요일, 월수금=월요일+수요일+금요일
- 주말=토요일+일요일, 평일=월~금
- 2-6시, 2~6시 = 14:00~18:00 (오후)
- 오전=09:00~12:00, 오후=13:00~18:00, 저녁=18:00~22:00
- "가능" → "available", "안됨/불가/못" → "unavailable"
- 불가능한 날은 하루종일: 09:00~22:00`,
          },
        ],
      },
    )) as {
      response?: unknown
      choices?: { message?: { content?: unknown } }[]
    }

    // guided_json guarantees schema-conforming output, but the runtime may
    // hand it back as an already-parsed object or as a JSON string.
    const raw = response.choices?.[0]?.message?.content ?? response.response

    let parsed: { slots?: LocalSlot[] }
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw as typeof parsed)
    } catch {
      throw new Error(
        '시간 분석 결과를 파싱할 수 없습니다. 다시 시도해주세요.',
      )
    }

    const localSlots = parsed?.slots
    if (!Array.isArray(localSlots)) {
      throw new Error(
        'AI 응답에서 결과를 찾을 수 없습니다. 다시 시도해주세요.',
      )
    }

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
