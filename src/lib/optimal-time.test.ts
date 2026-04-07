import { describe, it, expect } from 'vitest'
import { findOptimalTime, findTopCandidates } from './optimal-time'

describe('findOptimalTime', () => {
  const eventStart = '2026-04-14T00:00:00Z'
  const eventEnd = '2026-04-16T00:00:00Z'

  it('가장 많은 사람이 참여 가능한 슬롯을 선택', () => {
    const slots = [
      // 참여자 A: 4/14 14:00-16:00
      { participantId: 'a', startAt: '2026-04-14T05:00:00Z', endAt: '2026-04-14T07:00:00Z', status: 'available' as const },
      // 참여자 B: 4/14 14:00-16:00 (같은 시간)
      { participantId: 'b', startAt: '2026-04-14T05:00:00Z', endAt: '2026-04-14T07:00:00Z', status: 'available' as const },
      // 참여자 C: 4/15 10:00-12:00 (다른 시간)
      { participantId: 'c', startAt: '2026-04-15T01:00:00Z', endAt: '2026-04-15T03:00:00Z', status: 'available' as const },
    ]

    const result = findOptimalTime(slots, 60, eventStart, eventEnd, 3)
    expect(result).not.toBeNull()
    expect(result!.availableCount).toBe(2)
    expect(result!.start).toBe('2026-04-14T05:00:00.000Z')
  })

  it('가용 슬롯이 없으면 null 반환', () => {
    const result = findOptimalTime([], 60, eventStart, eventEnd, 2)
    expect(result).toBeNull()
  })

  it('동점 시 가장 이른 시간 선택', () => {
    const slots = [
      { participantId: 'a', startAt: '2026-04-14T05:00:00Z', endAt: '2026-04-14T07:00:00Z', status: 'available' as const },
      { participantId: 'a', startAt: '2026-04-15T05:00:00Z', endAt: '2026-04-15T07:00:00Z', status: 'available' as const },
    ]

    const result = findOptimalTime(slots, 60, eventStart, eventEnd, 1)
    expect(result).not.toBeNull()
    expect(result!.start).toBe('2026-04-14T05:00:00.000Z')
  })

  it('회의 시간보다 짧은 가용 슬롯은 선택하지 않음', () => {
    const slots = [
      // 30분짜리 슬롯 하나
      { participantId: 'a', startAt: '2026-04-14T05:00:00Z', endAt: '2026-04-14T05:30:00Z', status: 'available' as const },
    ]

    const result = findOptimalTime(slots, 60, eventStart, eventEnd, 1)
    expect(result).toBeNull()
  })

  it('unavailable 슬롯은 무시', () => {
    const slots = [
      { participantId: 'a', startAt: '2026-04-14T05:00:00Z', endAt: '2026-04-14T07:00:00Z', status: 'unavailable' as const },
      { participantId: 'b', startAt: '2026-04-14T05:00:00Z', endAt: '2026-04-14T07:00:00Z', status: 'available' as const },
    ]

    const result = findOptimalTime(slots, 60, eventStart, eventEnd, 2)
    expect(result).not.toBeNull()
    expect(result!.availableCount).toBe(1)
  })

  it('공통 시간이 없어도 가장 많은 참여자가 가능한 시간을 선택 (부분 매칭)', () => {
    const slots = [
      // A: 4/14 05:00-06:00 (1시간)
      { participantId: 'a', startAt: '2026-04-14T05:00:00Z', endAt: '2026-04-14T06:00:00Z', status: 'available' as const },
      // B: 4/14 05:30-06:30 (1시간, A와 30분만 겹침 → 90분 회의에 공통 교집합 없음)
      { participantId: 'b', startAt: '2026-04-14T05:30:00Z', endAt: '2026-04-14T06:30:00Z', status: 'available' as const },
    ]

    // 90분 회의: 두 사람이 동시에 90분을 맞출 수 없음 → 부분 매칭으로 최선 선택
    const result = findOptimalTime(slots, 90, eventStart, eventEnd, 2)
    expect(result).not.toBeNull()
    expect(result!.availableCount).toBeGreaterThanOrEqual(1)
  })

  it('eventDateStart에 초/밀리초가 포함되어도 슬롯을 찾는다', () => {
    // 실제 프로덕션 버그 재현: new Date()로 생성된 이벤트 날짜에 초/밀리초 포함
    const dirtyStart = '2026-04-08T01:31:02.990Z'
    const dirtyEnd = '2026-04-21T01:31:02.990Z'
    const slots = [
      { participantId: 'a', startAt: '2026-04-08T05:00:00.000Z', endAt: '2026-04-08T06:00:00.000Z', status: 'available' as const },
      { participantId: 'b', startAt: '2026-04-08T05:00:00.000Z', endAt: '2026-04-08T06:00:00.000Z', status: 'available' as const },
    ]

    const result = findOptimalTime(slots, 60, dirtyStart, dirtyEnd, 2)
    expect(result).not.toBeNull()
    expect(result!.availableCount).toBe(2)
    expect(result!.start).toBe('2026-04-08T05:00:00.000Z')
  })
})

describe('findTopCandidates', () => {
  it('겹치지 않는 상위 후보를 반환한다', () => {
    const slots = [
      { participantId: 'a', startAt: '2026-04-14T05:00:00Z', endAt: '2026-04-14T07:00:00Z', status: 'available' as const },
      { participantId: 'b', startAt: '2026-04-14T05:00:00Z', endAt: '2026-04-14T07:00:00Z', status: 'available' as const },
      { participantId: 'a', startAt: '2026-04-15T05:00:00Z', endAt: '2026-04-15T07:00:00Z', status: 'available' as const },
    ]

    const results = findTopCandidates(slots, 60, '2026-04-14T00:00:00Z', '2026-04-16T00:00:00Z', 2)
    expect(results.length).toBeGreaterThanOrEqual(2)
    expect(results[0].availableCount).toBe(2)
    // 두 번째 후보는 첫 번째와 겹치지 않아야 함
    expect(results[1].start >= results[0].end || results[1].end <= results[0].start).toBe(true)
  })

  it('eventDateStart에 초/밀리초가 포함되어도 후보를 찾는다', () => {
    const slots = [
      { participantId: 'a', startAt: '2026-04-08T05:00:00.000Z', endAt: '2026-04-08T06:00:00.000Z', status: 'available' as const },
    ]

    const results = findTopCandidates(slots, 60, '2026-04-08T01:31:02.990Z', '2026-04-21T01:31:02.990Z', 1)
    expect(results.length).toBe(1)
    expect(results[0].start).toBe('2026-04-08T05:00:00.000Z')
  })
})
