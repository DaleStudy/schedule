import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { Button, Label, Card, Link as DaleLink, VStack, Flex, Heading, Text } from 'daleui'
import { Copy, Check, SquarePen } from 'lucide-react'
import {
  getEventByAdminToken,
  confirmEvent,
  getCandidateTimes,
} from '../../server/functions/events'
import type { OptimalResult } from '../../lib/optimal-time'
import { TimeGrid } from '../../components/time-grid'
import { TimezoneSelector } from '../../components/timezone-selector'
import { dayjs } from '../../lib/time'

interface AdminSearch {
  token: string
}

export const Route = createFileRoute('/$eventId/admin')({
  validateSearch: (search: Record<string, unknown>): AdminSearch => ({
    token: (search.token as string) || '',
  }),
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ deps }) => {
    return getEventByAdminToken({ data: { adminToken: deps.token } })
  },
  component: AdminDashboard,
})

function AdminDashboard() {
  const event = Route.useLoaderData()
  const { token } = Route.useSearch()
  const [isConfirming, setIsConfirming] = useState(false)
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [candidates, setCandidates] = useState<OptimalResult[] | null>(null)
  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [timezone, setTimezone] = useState(detectedTz)

  const respondedCount = event.participants.filter((p) => p.respondedAt).length
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const SLOT_MIN = 30

  // 히트맵: 셀별 가능 인원 수
  const heatmap = useMemo(() => {
    if (!event.slots || event.slots.length === 0) return undefined
    const map = new Map<string, number>()
    for (const slot of event.slots) {
      if (slot.status !== 'available') continue
      let cursor = dayjs.utc(slot.startAt).tz(timezone)
      const end = dayjs.utc(slot.endAt).tz(timezone)
      while (cursor.isBefore(end)) {
        const key = `${cursor.format('YYYY-MM-DD')} ${cursor.format('H:mm')}`
        map.set(key, (map.get(key) ?? 0) + 1)
        cursor = cursor.add(SLOT_MIN, 'minute')
      }
    }
    return map
  }, [event.slots, timezone])

  const heatmapMax = heatmap ? Math.max(...heatmap.values(), 1) : 1

  // 이탈자 감지: 다수(50%+)가 가능한 시간에 참여 불가능한 사람
  const outliers = useMemo(() => {
    if (!event.slots || respondedCount < 2) return []
    const threshold = Math.ceil(respondedCount / 2)

    // 다수가 가능한 셀 키 집합
    const popularCells = new Set<string>()
    if (heatmap) {
      for (const [key, count] of heatmap) {
        if (count >= threshold) popularCells.add(key)
      }
    }
    if (popularCells.size === 0) return []

    // 참여자별 가능 셀 집합
    const respondedParticipants = event.participants.filter((p) => p.respondedAt)
    const participantCells = new Map<string, Set<string>>()
    for (const p of respondedParticipants) {
      participantCells.set(p.id, new Set())
    }
    for (const slot of event.slots) {
      if (slot.status !== 'available') continue
      const cells = participantCells.get(slot.participantId)
      if (!cells) continue
      let cursor = dayjs.utc(slot.startAt).tz(timezone)
      const end = dayjs.utc(slot.endAt).tz(timezone)
      while (cursor.isBefore(end)) {
        cells.add(`${cursor.format('YYYY-MM-DD')} ${cursor.format('H:mm')}`)
        cursor = cursor.add(SLOT_MIN, 'minute')
      }
    }

    // 다수 시간과 겹침이 적은 참여자 찾기
    const result: Array<{ name: string; email: string; overlapPercent: number }> = []
    for (const p of respondedParticipants) {
      const cells = participantCells.get(p.id)!
      let overlap = 0
      for (const key of popularCells) {
        if (cells.has(key)) overlap++
      }
      const overlapPercent = Math.round((overlap / popularCells.size) * 100)
      if (overlapPercent < 30) {
        result.push({ name: p.name, email: p.email, overlapPercent })
      }
    }
    return result.sort((a, b) => a.overlapPercent - b.overlapPercent)
  }, [event.slots, event.participants, respondedCount, heatmap, timezone])

  const handleShowCandidates = async () => {
    setIsLoadingCandidates(true)
    try {
      const results = await getCandidateTimes({
        data: { eventId: event.id, adminToken: token },
      })
      if (results.length === 0) {
        alert('참여 가능한 공통 시간을 찾을 수 없습니다.')
        return
      }
      if (results.length === 1) {
        await handleConfirm(results[0].start, results[0].end)
        return
      }
      setCandidates(results)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setIsLoadingCandidates(false)
    }
  }

  const handleConfirm = async (start: string, end: string) => {
    if (!confirm('이 시간으로 확정하시겠습니까?')) return
    setIsConfirming(true)
    try {
      await confirmEvent({
        data: { eventId: event.id, adminToken: token, confirmedStart: start, confirmedEnd: end },
      })
      window.location.reload()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <VStack align="stretch" gap="24">
      <div>
        <Heading level={1}>{event.title}</Heading>
        <Text size="sm" tone="neutral">주최자 대시보드</Text>
      </div>

      <div>
        <Label labelText="참여자 공유 링크" />
        <CopyField value={`${baseUrl}/${event.id}`} />
      </div>

      {event.status === 'confirmed' && event.confirmedStart && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-green-800">
            확정된 모임 시간
          </h2>
          <p className="text-lg font-medium text-green-900">
            {new Date(event.confirmedStart).toLocaleString('ko-KR', {
              month: 'long', day: 'numeric', weekday: 'short',
              hour: '2-digit', minute: '2-digit',
            })}
            {' ~ '}
            {new Date(event.confirmedEnd!).toLocaleString('ko-KR', {
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
      )}

      {event.status === 'pending' && (
        <VStack align="stretch" gap="16">
          <div className="overflow-hidden rounded-lg border border-blue-200">
            <div className="bg-blue-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-blue-800">응답 현황</span>
                <span className="text-sm text-blue-600">
                  {respondedCount}/{event.participants.length}명 응답
                </span>
              </div>
              <p className="text-xs text-blue-600">
                응답 마감:{' '}
                {new Date(event.responseDeadlineAt).toLocaleDateString('ko-KR')}
              </p>
            </div>
            {event.participants.length > 0 && (
              <div className="divide-y">
                {event.participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <Text as="span" weight="medium">{p.name}</Text>
                      <Text as="span" size="xs" tone="neutral" className="ml-2">{p.email}</Text>
                    </div>
                    <Text as="span" size="xs" tone={p.respondedAt ? 'success' : 'neutral'}>
                      {p.respondedAt ? '응답 완료' : '대기 중'}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </div>

          {respondedCount > 0 && heatmap && heatmap.size > 0 && (
            <div>
              <Flex align="center" justify="between" className="mb-2">
                <Text weight="medium">전체 응답 현황</Text>
                <TimezoneSelector value={timezone} onChange={setTimezone} />
              </Flex>
              <TimeGrid
                eventDateStart={event.eventDateStart}
                eventDateEnd={event.eventDateEnd}
                timezone={timezone}
                slots={[]}
                onSlotsChange={() => {}}
                readOnly
                heatmap={heatmap}
                heatmapMax={heatmapMax}
              />
            </div>
          )}

          {outliers.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <Text size="sm" weight="medium" className="text-amber-800 mb-2">
                다수와 시간이 맞지 않는 참여자
              </Text>
              <Text size="xs" tone="neutral" className="mb-3">
                아래 참여자의 가능 시간이 다른 참여자들과 거의 겹치지 않습니다. 추가 조율이 필요할 수 있습니다.
              </Text>
              <div className="space-y-1">
                {outliers.map((o) => (
                  <div key={o.email} className="flex items-center justify-between text-sm">
                    <span>
                      <Text as="span" weight="medium">{o.name}</Text>
                      <Text as="span" size="xs" tone="neutral" className="ml-2">{o.email}</Text>
                    </span>
                    <Text as="span" size="xs" className="text-amber-700">
                      겹침 {o.overlapPercent}%
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )}

          {respondedCount > 0 && !candidates && (
            <Button
              fullWidth
              onClick={handleShowCandidates}
              disabled={isLoadingCandidates || isConfirming}
              loading={isLoadingCandidates}
            >
              {isLoadingCandidates ? '후보 탐색 중...' : '지금 확정'}
            </Button>
          )}

          {candidates && candidates.length > 1 && (
            <div className="space-y-3">
              <div>
                <Text weight="medium">확정할 시간을 선택하세요</Text>
                <Text size="xs" tone="neutral">
                  참여 가능 인원이 많은 순서입니다.
                </Text>
              </div>
              {candidates.map((c, i) => (
                <button
                  key={c.start}
                  onClick={() => handleConfirm(c.start, c.end)}
                  disabled={isConfirming}
                  className="w-full rounded-lg border p-4 text-left hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <Flex align="center" justify="between">
                    <div>
                      <Text weight="medium">
                        {i + 1}. {new Date(c.start).toLocaleDateString('ko-KR', {
                          month: 'long', day: 'numeric', weekday: 'short',
                        })}{' '}
                        {new Date(c.start).toLocaleTimeString('ko-KR', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                        {' ~ '}
                        {new Date(c.end).toLocaleTimeString('ko-KR', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                    </div>
                    <Text size="sm" tone="success">
                      {c.availableCount}/{c.totalParticipants}명 가능
                    </Text>
                  </Flex>
                </button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => setCandidates(null)}
              >
                취소
              </Button>
            </div>
          )}
        </VStack>
      )}

      <EventInfoSection event={event} token={token} />
    </VStack>
  )
}

function EventInfoSection({
  event,
  token,
}: {
  event: { id: string; durationMinutes: number; eventDateStart: string; eventDateEnd: string; responseDeadlineAt: string; status: string; minParticipants: number | null }
  token: string
}) {
  return (
    <Card outline>
      <Card.Body>
        <Flex align="center" justify="between">
          <Card.Title>모임 정보</Card.Title>
          {event.status === 'pending' && (
            <Link
              to="/$eventId/edit"
              params={{ eventId: event.id }}
              search={{ token }}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <SquarePen size={14} /> 수정
            </Link>
          )}
        </Flex>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">목표 기간</dt>
            <dd>
              {new Date(event.eventDateStart).toLocaleDateString('ko-KR')} ~{' '}
              {new Date(event.eventDateEnd).toLocaleDateString('ko-KR')}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">소요 시간</dt>
            <dd>{event.durationMinutes}분</dd>
          </div>
          {event.minParticipants && (
            <div className="flex justify-between">
              <dt className="text-gray-500">최소 인원</dt>
              <dd>{event.minParticipants}명</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-500">응답 마감</dt>
            <dd>{new Date(event.responseDeadlineAt).toLocaleDateString('ko-KR')}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">상태</dt>
            <dd>
              {event.status === 'pending'
                ? '대기 중'
                : event.status === 'confirmed'
                  ? '확정됨'
                  : '취소됨'}
            </dd>
          </div>
        </dl>
      </Card.Body>
    </Card>
  )
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 rounded border bg-gray-50 px-3 py-2">
      <DaleLink href={value} external size="sm" className="flex-1 truncate">{value}</DaleLink>
      <Button type="button" variant="ghost" size="sm" onClick={copy}>
        {copied ? <><Check size={14} /> 복사됨</> : <><Copy size={14} /> 복사</>}
      </Button>
    </div>
  )
}
