import { createFileRoute } from '@tanstack/react-router'
import { getEvent } from '../../../server/functions/events'

export const Route = createFileRoute('/event/$eventId/')({
  loader: async ({ params }) => {
    return getEvent({ data: { eventId: params.eventId } })
  },
  component: EventStatusPage,
})

function EventStatusPage() {
  const event = Route.useLoaderData()

  const respondedCount = event.participants.filter((p) => p.respondedAt).length
  const totalCount = event.participants.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        {event.description && (
          <p className="mt-1 text-gray-600">{event.description}</p>
        )}
      </div>

      <StatusBadge status={event.status} />

      {event.status === 'confirmed' && event.confirmedStart && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-green-800">
            확정된 모임 시간
          </h2>
          <p className="text-lg font-medium text-green-900">
            {formatDateTime(event.confirmedStart)} ~{' '}
            {formatTime(event.confirmedEnd!)}
          </p>
          <p className="mt-1 text-sm text-green-700">
            {event.durationMinutes}분 동안 진행
          </p>
        </div>
      )}

      {event.status === 'cancelled' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-800">
            일정이 취소되었습니다
          </h2>
          <p className="text-sm text-red-700">
            참여 가능한 공통 시간을 찾을 수 없었습니다.
          </p>
        </div>
      )}

      {event.status === 'pending' && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-yellow-800">
            응답 대기 중
          </h2>
          <div className="mb-2 h-2 w-full rounded-full bg-yellow-200">
            <div
              className="h-2 rounded-full bg-yellow-500 transition-all"
              style={{
                width: `${totalCount > 0 ? (respondedCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="text-sm text-yellow-700">
            {respondedCount} / {totalCount}명 응답 완료
          </p>
          <p className="mt-2 text-xs text-yellow-600">
            응답 마감: {formatDateTime(event.responseDeadlineAt)}
          </p>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700">참여자 현황</h3>
        <div className="divide-y rounded-lg border">
          {event.participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="font-medium">{p.name}</span>
              <span
                className={`text-xs ${p.respondedAt ? 'text-green-600' : 'text-gray-400'}`}
              >
                {p.respondedAt ? '응답 완료' : '대기 중'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-sm text-gray-500">
        <p>모임 가능 기간: {formatDate(event.eventDateStart)} ~ {formatDate(event.eventDateEnd)}</p>
        <p>모임 시간: {event.durationMinutes}분</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  const labels = {
    pending: '응답 대기 중',
    confirmed: '확정됨',
    cancelled: '취소됨',
  }
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${styles[status as keyof typeof styles]}`}
    >
      {labels[status as keyof typeof labels]}
    </span>
  )
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}
