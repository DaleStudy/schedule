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

    const dates: string[] = []
    let cursor = dayjs.utc(data.eventDateStart).tz(data.participantTimezone)
    const end = dayjs.utc(data.eventDateEnd).tz(data.participantTimezone)
    while (!cursor.isAfter(end)) {
      const dow = ['일', '월', '화', '수', '목', '금', '토'][cursor.day()]
      dates.push(`${cursor.format('YYYY-MM-DD')}(${dow})`)
      cursor = cursor.add(1, 'day')
    }

    const response = (await env.AI.run(
      '@cf/google/gemma-3-12b-it',
      {
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `당신은 일정 파서입니다. 사용자의 가용 시간을 JSON으로 변환하세요.

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
- 불가능한 날은 하루종일: 09:00~22:00

JSON 배열만 출력하세요. 설명 없이.
[{"date":"YYYY-MM-DD","startTime":"HH:mm","endTime":"HH:mm","status":"available"|"unavailable"}]`,
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
