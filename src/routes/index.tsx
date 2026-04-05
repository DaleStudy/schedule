import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button, Tag, VStack, Flex, HStack, Heading } from 'daleui'
import { getLocalEvents, type LocalEvent } from '../lib/local-events'
import { getEventStatuses } from '../server/functions/events'

export const Route = createFileRoute('/')({
  component: HomePage,
})

interface EventStatus {
  id: string
  title: string
  status: string
  confirmedStart: string | null
  confirmedEnd: string | null
  eventDateEnd: string
}

function HomePage() {
  const navigate = useNavigate()
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([])
  const [statuses, setStatuses] = useState<Map<string, EventStatus>>(new Map())

  useEffect(() => {
    const events = getLocalEvents()
    setLocalEvents(events)

    if (events.length > 0) {
      const ids = [...new Set(events.map((e) => e.eventId))]
      getEventStatuses({ data: { eventIds: ids } }).then((results) => {
        const map = new Map<string, EventStatus>()
        for (const r of results) {
          map.set(r.id, r)
        }
        setStatuses(map)
      })
    }
  }, [])

  return (
    <VStack align="stretch" gap="24">
      <Flex align="center" justify="between">
        <Heading level={1}>모임 목록</Heading>
        <Button size="sm" onClick={() => navigate({ to: '/new' })}>
          + 새 모임
        </Button>
      </Flex>

      {localEvents.length > 0 ? (
        <div className="divide-y overflow-hidden rounded-lg border">
          {localEvents.map((e) => {
            const status = statuses.get(e.eventId)
            return (
              <Link
                key={`${e.eventId}-${e.role}`}
                to={
                  e.role === 'admin'
                    ? `/${e.eventId}/admin`
                    : `/${e.eventId}`
                }
                search={e.role === 'admin' ? { token: e.adminToken! } : {}}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <HStack gap="8">
                  <span className="font-medium">{status?.title ?? e.title ?? e.eventId}</span>
                  <span className="text-xs text-gray-400">
                    {e.role === 'admin' ? '주최' : '참여'}
                  </span>
                  {status && <StatusBadge status={status} />}
                </HStack>
                <span className="text-xs text-gray-400">
                  {new Date(e.createdAt).toLocaleDateString('ko-KR')}
                </span>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-gray-400">
          <p>아직 참여한 모임이 없습니다.</p>
          <Link
            to="/new"
            className="mt-2 inline-block text-blue-600 hover:underline"
          >
            새 모임
          </Link>
        </div>
      )}
    </VStack>
  )
}

function StatusBadge({ status }: { status: EventStatus }) {
  const now = new Date()
  const isPast =
    status.status === 'confirmed' &&
    status.confirmedEnd &&
    new Date(status.confirmedEnd) < now

  if (isPast) {
    return <Tag tone="neutral">종료</Tag>
  }

  const tones: Record<string, 'warning' | 'success' | 'danger'> = {
    pending: 'warning',
    confirmed: 'success',
    cancelled: 'danger',
  }
  const labels: Record<string, string> = {
    pending: '대기 중',
    confirmed: '확정',
    cancelled: '실패',
  }

  return (
    <Tag tone={tones[status.status]}>
      {labels[status.status] ?? status.status}
    </Tag>
  )
}
