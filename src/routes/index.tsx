import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { getLocalEvents, type LocalEvent } from '../lib/local-events'
import { getEventStatuses } from '../server/functions/events'

export const Route = createFileRoute('/')({
  component: HomePage,
})

interface EventStatus {
  id: string
  status: string
  confirmedStart: string | null
  confirmedEnd: string | null
  eventDateEnd: string
}

function HomePage() {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">내 모임</h1>
        <Link
          to="/new"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + 새 모임 만들기
        </Link>
      </div>

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
                <div className="flex items-center gap-2">
                  <span className="font-medium">{e.title}</span>
                  <span className="text-xs text-gray-400">
                    {e.role === 'admin' ? '주최' : '참여'}
                  </span>
                  {status && <StatusBadge status={status} />}
                </div>
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
            새 모임 만들기
          </Link>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: EventStatus }) {
  const now = new Date()
  const isPast =
    status.status === 'confirmed' &&
    status.confirmedEnd &&
    new Date(status.confirmedEnd) < now

  if (isPast) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
        종료
      </span>
    )
  }

  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    pending: '대기 중',
    confirmed: '확정',
    cancelled: '실패',
  }

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${styles[status.status] ?? ''}`}
    >
      {labels[status.status] ?? status.status}
    </span>
  )
}
