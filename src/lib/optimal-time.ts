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
  availableParticipantIds: string[]
}

const SLOT_MINUTES = 30

/**
 * 가장 많은 사람이 참여 가능한 시간대를 찾는다.
 *
 * 1차: 모든 셀에 참여 가능한 사람의 교집합이 가장 큰 윈도우
 * 2차: 교집합이 없으면, 셀별 최소 참여자가 가장 큰 윈도우 (부분 매칭)
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

  const rangeStart = dayjs.utc(eventDateStart).startOf('day')
  const rangeEnd = dayjs.utc(eventDateEnd).endOf('day')

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
  let bestParticipantIds: string[] = []

  // 슬라이딩 윈도우로 최적 시간 탐색
  let cursor = rangeStart
  while (!cursor.add(durationMinutes, 'minute').isAfter(rangeEnd)) {
    let windowParticipants: Set<string> | null = null

    for (let i = 0; i < requiredCells; i++) {
      const cellKey = cursor.add(i * SLOT_MINUTES, 'minute').toISOString()
      const cellParticipants = cellMap.get(cellKey)

      if (!cellParticipants || cellParticipants.size === 0) {
        windowParticipants = new Set()
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
    }

    const count = windowParticipants?.size ?? 0
    if (count > bestCount) {
      bestCount = count
      bestStart = cursor.toISOString()
      bestParticipantIds = [...windowParticipants!]
    }

    cursor = cursor.add(SLOT_MINUTES, 'minute')
  }

  // 완전한 교집합을 찾은 경우
  if (bestStart && bestCount > 0) {
    return {
      start: bestStart,
      end: dayjs.utc(bestStart).add(durationMinutes, 'minute').toISOString(),
      availableCount: bestCount,
      totalParticipants,
      availableParticipantIds: bestParticipantIds,
    }
  }

  // 2차: 교집합이 없으면, 셀별 최소 참여자 수가 가장 높은 윈도우 선택
  let fallbackStart: string | null = null
  let fallbackMinCount = 0

  cursor = rangeStart
  while (!cursor.add(durationMinutes, 'minute').isAfter(rangeEnd)) {
    let minInWindow = Infinity

    for (let i = 0; i < requiredCells; i++) {
      const cellKey = cursor.add(i * SLOT_MINUTES, 'minute').toISOString()
      const cellParticipants = cellMap.get(cellKey)
      minInWindow = Math.min(minInWindow, cellParticipants?.size ?? 0)
    }

    if (minInWindow > fallbackMinCount) {
      fallbackMinCount = minInWindow
      fallbackStart = cursor.toISOString()
    }

    cursor = cursor.add(SLOT_MINUTES, 'minute')
  }

  if (fallbackStart && fallbackMinCount > 0) {
    return {
      start: fallbackStart,
      end: dayjs
        .utc(fallbackStart)
        .add(durationMinutes, 'minute')
        .toISOString(),
      availableCount: fallbackMinCount,
      totalParticipants,
      availableParticipantIds: [],
    }
  }

  return null
}

/**
 * 겹치지 않는 상위 후보 시간대를 최대 maxResults개 반환한다.
 * 참여 가능 인원이 많은 순서로 정렬.
 */
export function findTopCandidates(
  slots: AvailabilitySlot[],
  durationMinutes: number,
  eventDateStart: string,
  eventDateEnd: string,
  totalParticipants: number,
  maxResults = 5,
): OptimalResult[] {
  const availableSlots = slots.filter((s) => s.status === 'available')
  if (availableSlots.length === 0) return []

  const rangeStart = dayjs.utc(eventDateStart).startOf('day')
  const rangeEnd = dayjs.utc(eventDateEnd).endOf('day')

  // 셀 단위 가용성 맵
  const cellMap = new Map<string, Set<string>>()
  for (const slot of availableSlots) {
    let cursor = dayjs.utc(slot.startAt)
    const end = dayjs.utc(slot.endAt)
    while (cursor.isBefore(end)) {
      const key = cursor.toISOString()
      if (!cellMap.has(key)) cellMap.set(key, new Set())
      cellMap.get(key)!.add(slot.participantId)
      cursor = cursor.add(SLOT_MINUTES, 'minute')
    }
  }

  const requiredCells = Math.ceil(durationMinutes / SLOT_MINUTES)

  // 모든 윈도우 점수 계산
  const scored: Array<{ start: string; end: string; count: number; participantIds: string[] }> = []
  let cursor = rangeStart
  while (!cursor.add(durationMinutes, 'minute').isAfter(rangeEnd)) {
    let windowParticipants: Set<string> | null = null

    for (let i = 0; i < requiredCells; i++) {
      const cellKey = cursor.add(i * SLOT_MINUTES, 'minute').toISOString()
      const cellP = cellMap.get(cellKey)
      if (!cellP || cellP.size === 0) {
        windowParticipants = new Set()
        break
      }
      if (windowParticipants === null) {
        windowParticipants = new Set(cellP)
      } else {
        for (const p of windowParticipants) {
          if (!cellP.has(p)) windowParticipants.delete(p)
        }
      }
    }

    const count = windowParticipants?.size ?? 0
    if (count > 0) {
      scored.push({
        start: cursor.toISOString(),
        end: cursor.add(durationMinutes, 'minute').toISOString(),
        count,
        participantIds: [...windowParticipants!],
      })
    }
    cursor = cursor.add(SLOT_MINUTES, 'minute')
  }

  // 참여자 수 내림차순, 같으면 빠른 시간 우선
  scored.sort((a, b) => b.count - a.count || a.start.localeCompare(b.start))

  // 겹치지 않는 상위 후보 선택
  const results: OptimalResult[] = []
  for (const s of scored) {
    if (results.length >= maxResults) break
    const overlaps = results.some(
      (r) => s.start < r.end && s.end > r.start,
    )
    if (!overlaps) {
      results.push({
        start: s.start,
        end: s.end,
        availableCount: s.count,
        totalParticipants,
        availableParticipantIds: s.participantIds,
      })
    }
  }

  return results
}
