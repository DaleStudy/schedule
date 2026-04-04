import { dayjs } from './time'

interface AvailabilitySlot {
  participantId: string
  startAt: string
  endAt: string
  status: 'available' | 'unavailable'
}

export interface OptimalResult {
  start: string
  end: string
  availableCount: number
  totalParticipants: number
}

const SLOT_MINUTES = 30

/**
 * 모든 응답자의 가용 슬롯을 분석하여 가장 많은 사람이 참여 가능한 시간대를 찾는다.
 *
 * 알고리즘:
 * 1. 각 available 슬롯을 30분 셀로 이산화
 * 2. 셀별 참여 가능 인원 Set 구성
 * 3. 회의 길이만큼의 연속 셀 윈도우를 슬라이딩하며
 *    교집합(모든 셀에 참여 가능한 사람)의 크기를 계산
 * 4. 교집합이 가장 큰 윈도우 선택 (동점 시 가장 이른 시간)
 */
export function findOptimalTime(
  slots: AvailabilitySlot[],
  durationMinutes: number,
  eventDateStart: string,
  eventDateEnd: string,
  totalParticipants: number,
): OptimalResult | null {
  const availableSlots = slots.filter((s) => s.status === 'available')
  if (availableSlots.length === 0) return null

  const rangeStart = dayjs.utc(eventDateStart)
  const rangeEnd = dayjs.utc(eventDateEnd)

  // 셀 단위 가용성 맵: timestamp -> Set<participantId>
  const cellMap = new Map<string, Set<string>>()

  for (const slot of availableSlots) {
    const slotStart = dayjs.utc(slot.startAt)
    const slotEnd = dayjs.utc(slot.endAt)

    let cursor = slotStart
    while (cursor.isBefore(slotEnd)) {
      const cellKey = cursor.toISOString()
      if (!cellMap.has(cellKey)) {
        cellMap.set(cellKey, new Set())
      }
      cellMap.get(cellKey)!.add(slot.participantId)
      cursor = cursor.add(SLOT_MINUTES, 'minute')
    }
  }

  const requiredCells = Math.ceil(durationMinutes / SLOT_MINUTES)
  let bestStart: string | null = null
  let bestCount = 0

  // 슬라이딩 윈도우로 최적 시간 탐색
  let cursor = rangeStart
  while (!cursor.add(durationMinutes, 'minute').isAfter(rangeEnd)) {
    let windowParticipants: Set<string> | null = null

    for (let i = 0; i < requiredCells; i++) {
      const cellKey = cursor.add(i * SLOT_MINUTES, 'minute').toISOString()
      const cellParticipants = cellMap.get(cellKey)

      if (!cellParticipants || cellParticipants.size === 0) {
        windowParticipants = null
        break
      }

      if (windowParticipants === null) {
        windowParticipants = new Set(cellParticipants)
      } else {
        for (const p of windowParticipants) {
          if (!cellParticipants.has(p)) {
            windowParticipants.delete(p)
          }
        }
      }

      if (windowParticipants.size === 0) break
    }

    const count = windowParticipants?.size ?? 0
    if (count > bestCount) {
      bestCount = count
      bestStart = cursor.toISOString()
    }

    cursor = cursor.add(SLOT_MINUTES, 'minute')
  }

  if (!bestStart || bestCount === 0) return null

  return {
    start: bestStart,
    end: dayjs.utc(bestStart).add(durationMinutes, 'minute').toISOString(),
    availableCount: bestCount,
    totalParticipants,
  }
}
