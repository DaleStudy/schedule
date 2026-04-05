import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, VStack, Flex, Heading, Text } from 'daleui'
import {
  getEventByAdminToken,
  confirmEvent,
} from '../../server/functions/events'

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

  const respondedCount = event.participants.filter((p) => p.respondedAt).length
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const handleConfirm = async () => {
    if (!confirm('현재 응답을 기반으로 최적 시간을 확정하시겠습니까?')) return
    setIsConfirming(true)
    try {
      await confirmEvent({
        data: { eventId: event.id, adminToken: token },
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
        <>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-blue-800">응답 현황</span>
              <span className="text-sm text-blue-600">
                {respondedCount}명 응답
              </span>
            </div>
            <p className="text-xs text-blue-600">
              응답 마감:{' '}
              {new Date(event.responseDeadlineAt).toLocaleDateString('ko-KR')}
            </p>
          </div>

          {respondedCount > 0 && (
            <Button
              fullWidth
              onClick={handleConfirm}
              disabled={isConfirming}
              loading={isConfirming}
            >
              {isConfirming ? '확정 중...' : '지금 확정'}
            </Button>
          )}
        </>
      )}

      {respondedCount > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">참여자</h3>
          <div className="divide-y rounded-lg border">
            {event.participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <Text as="span" weight="medium">{p.name}</Text>
                <Text as="span" size="xs" tone={p.respondedAt ? 'success' : 'neutral'}>
                  {p.respondedAt ? '응답 완료' : '대기 중'}
                </Text>
              </div>
            ))}
          </div>
        </div>
      )}

      <VStack align="stretch" gap="12">
        <div>
          <Label labelText="참여자 공유 링크" />
          <CopyField value={`${baseUrl}/${event.id}`} />
        </div>

        <EventInfoSection event={event} token={token} />
      </VStack>
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
    <div className="rounded-lg border p-4">
      <Flex align="center" justify="between" className="mb-2">
        <h3 className="text-sm font-medium text-gray-700">모임 정보</h3>
        {event.status === 'pending' && (
          <Link
            to="/$eventId/edit"
            params={{ eventId: event.id }}
            search={{ token }}
            className="text-sm text-blue-600 hover:underline"
          >
            수정
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
    </div>
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
      <a href={value} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm text-blue-600 hover:underline">{value}</a>
      <Button type="button" variant="ghost" size="sm" onClick={copy}>
        {copied ? '복사됨!' : '복사'}
      </Button>
    </div>
  )
}
