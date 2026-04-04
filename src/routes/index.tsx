import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { getLocalEvents, type LocalEvent } from '../lib/local-events'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([])

  useEffect(() => {
    setLocalEvents(getLocalEvents())
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
        <div className="divide-y rounded-lg border">
          {localEvents.map((e) => (
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
              <div>
                <span className="font-medium">{e.title}</span>
                <span className="ml-2 text-xs text-gray-400">
                  {e.role === 'admin' ? '주최' : '참여'}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(e.createdAt).toLocaleDateString('ko-KR')}
              </span>
            </Link>
          ))}
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
