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
 *
 * 소요 시간을 다 채우는 후보보다 더 많은 인원이 가능한 짧은 구간이 있으면,
 * 그 구간을 겹치는 길이 그대로 후보에 포함한다.
 * (예: 60분 모임인데 두 사람이 겹치는 구간이 30분뿐인 경우)
 */
export function findTopCandidates(
  slots: AvailabilitySlot[],
  durationMinutes: number,
  eventDateStart: string,
  eventDateEnd: string,
  totalParticipants: number,
  maxResults = 10,
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

  // 시작 지점마다 셀을 한 칸씩 늘려가며 교집합을 추적한다.
  // 교집합은 늘릴수록 줄어들기만 하므로, 인원 수마다 가장 긴 구간 하나씩 남는다.
  const windows: Array<{
    start: string
    cells: number
    participantIds: string[]
  }> = []

  let cursor = rangeStart
  while (!cursor.add(SLOT_MINUTES, 'minute').isAfter(rangeEnd)) {
    const start = cursor.toISOString()
    let intersection = new Set<string>()
    let current: (typeof windows)[number] | null = null

    for (let i = 0; i < requiredCells; i++) {
      if (cursor.add((i + 1) * SLOT_MINUTES, 'minute').isAfter(rangeEnd)) break

      const cellP = cellMap.get(
        cursor.add(i * SLOT_MINUTES, 'minute').toISOString(),
      )
      if (!cellP || cellP.size === 0) break

      intersection =
        i === 0
          ? new Set(cellP)
          : new Set([...intersection].filter((p) => cellP.has(p)))
      if (intersection.size === 0) break

      if (current && current.participantIds.length === intersection.size) {
        current.cells = i + 1
      } else {
        current = { start, cells: i + 1, participantIds: [...intersection] }
        windows.push(current)
      }
    }

    cursor = cursor.add(SLOT_MINUTES, 'minute')
  }

  // 소요 시간을 다 채우는 후보 중 최대 인원
  const maxFullCount = windows.reduce(
    (max, w) =>
      w.cells >= requiredCells ? Math.max(max, w.participantIds.length) : max,
    0,
  )

  // 소요 시간을 채우는 후보 + 그보다 더 많은 인원이 가능한 짧은 후보
  const eligible = windows.filter(
    (w) => w.cells >= requiredCells || w.participantIds.length > maxFullCount,
  )

  // 인원 수 내림차순, 같으면 긴 구간 우선, 그다음 빠른 시간 우선
  eligible.sort(
    (a, b) =>
      b.participantIds.length - a.participantIds.length ||
      b.cells - a.cells ||
      a.start.localeCompare(b.start),
  )

  // 겹치지 않는 상위 후보 선택
  const results: OptimalResult[] = []
  for (const w of eligible) {
    if (results.length >= maxResults) break
    const end = dayjs
      .utc(w.start)
      .add(w.cells * SLOT_MINUTES, 'minute')
      .toISOString()
    if (results.some((r) => w.start < r.end && end > r.start)) continue
    results.push({
      start: w.start,
      end,
      availableCount: w.participantIds.length,
      totalParticipants,
      availableParticipantIds: w.participantIds,
    })
  }

  return results
}
