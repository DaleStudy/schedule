import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getEventByAdminToken, confirmEvent } from '../../../server/functions/events'
import { findOptimalTime } from '../../../lib/optimal-time'

interface AdminSearch {
  token: string
}

export const Route = createFileRoute('/event/$eventId/admin')({
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

  const respondedCount = event.participants.filter((p) => p.respondedAt).length
  const totalCount = event.participants.length
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const handleManualConfirm = async () => {
    // TODO: 최적 시간 미리보기에서 선택한 시간을 사용
    // 지금은 서버에서 최적 시간을 계산하도록 단순화
    setIsConfirming(true)
    try {
      // 단순화: 서버에서 계산 (실제로는 아래 미리보기의 시간을 사용)
      alert('자동 확정은 응답 마감일 또는 전원 응답 시 실행됩니다.')
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="text-sm text-gray-500">주최자 대시보드</p>
      </div>

      {event.status === 'confirmed' && event.confirmedStart && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-green-800">
            확정된 모임 시간
          </h2>
          <p className="text-lg font-medium text-green-900">
            {new Date(event.confirmedStart).toLocaleString('ko-KR', {
              month: 'long',
              day: 'numeric',
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            ~{' '}
            {new Date(event.confirmedEnd!).toLocaleString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      )}

      {event.status === 'pending' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-blue-800">응답 현황</span>
            <span className="text-sm text-blue-600">
              {respondedCount} / {totalCount}명
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-blue-200">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all"
              style={{
                width: `${totalCount > 0 ? (respondedCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-blue-600">
            응답 마감: {new Date(event.responseDeadlineAt).toLocaleDateString('ko-KR')}
          </p>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700">
          참여자 링크
        </h3>
        <div className="space-y-2">
          {event.participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  <span
                    className={`text-xs ${p.respondedAt ? 'text-green-600' : 'text-gray-400'}`}
                  >
                    {p.respondedAt ? '응답 완료' : '대기 중'}
                  </span>
                </div>
                <div className="mt-1 truncate text-xs text-gray-400">
                  {baseUrl}/event/{event.id}/respond?token={p.token}
                </div>
              </div>
              <CopyButton
                text={`${baseUrl}/event/${event.id}/respond?token=${p.token}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-medium text-gray-700">이벤트 정보</h3>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">모임 가능 기간</dt>
            <dd>
              {new Date(event.eventDateStart).toLocaleDateString('ko-KR')} ~{' '}
              {new Date(event.eventDateEnd).toLocaleDateString('ko-KR')}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">모임 시간</dt>
            <dd>{event.durationMinutes}분</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">상태</dt>
            <dd>{event.status === 'pending' ? '대기 중' : event.status === 'confirmed' ? '확정됨' : '취소됨'}</dd>
          </div>
        </dl>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700">공유 링크</h3>
        <div className="flex items-center gap-2 rounded border bg-gray-50 px-3 py-2">
          <span className="flex-1 truncate text-xs text-gray-600">
            {baseUrl}/event/{event.id}
          </span>
          <CopyButton text={`${baseUrl}/event/${event.id}`} />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          이 링크로 누구나 모임 상태를 확인할 수 있습니다.
        </p>
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="shrink-0 rounded border px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
    >
      {copied ? '복사됨!' : '복사'}
    </button>
  )
}
