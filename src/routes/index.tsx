import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button, Tag, VStack, Flex, HStack, Heading, TextInput } from 'daleui'
import { getUserProfile, saveUserProfile, saveAdminToken } from '../lib/local-events'
import { getMyEvents } from '../server/functions/events'

export const Route = createFileRoute('/')({
  component: HomePage,
})

interface MyEvent {
  id: string
  title: string
  status: string
  role: 'admin' | 'participant'
  adminToken: string | null
  eventDateStart: string
  eventDateEnd: string
  responseDeadlineAt: string
  confirmedStart: string | null
  confirmedEnd: string | null
  createdAt: string
}

function HomePage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [myEvents, setMyEvents] = useState<MyEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const profile = getUserProfile()
    if (profile?.email) {
      setEmail(profile.email)
      loadEvents(profile.email)
    }
  }, [])

  const loadEvents = async (emailToSearch: string) => {
    if (!emailToSearch.trim()) return
    setIsLoading(true)
    try {
      const results = await getMyEvents({ data: { email: emailToSearch.trim() } })
      for (const e of results) {
        if (e.adminToken) saveAdminToken(e.id, e.adminToken)
      }
      setMyEvents(results)
    } catch {
      setMyEvents([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    if (!email.trim()) return
    saveUserProfile({ email: email.trim(), name: '' })
    loadEvents(email.trim())
  }

  return (
    <VStack align="stretch" gap="24">
      <Flex align="center" justify="between">
        <Heading level={1}>모임 목록</Heading>
        <Button size="sm" onClick={() => navigate({ to: '/new' })}>
          + 새 모임
        </Button>
      </Flex>

      <HStack gap="8">
        <TextInput
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일로 내 모임 찾기"
          className="flex-1"
        />
        <Button size="sm" onClick={handleSearch} disabled={!email.trim() || isLoading}>
          {isLoading ? '검색 중...' : '검색'}
        </Button>
      </HStack>

      {myEvents.length > 0 ? (
        <VStack align="stretch" gap="24">
          <EventSection
            title="주최한 모임"
            events={myEvents.filter((e) => e.role === 'admin')}
          />
          <EventSection
            title="참여한 모임"
            events={myEvents.filter((e) => e.role === 'participant')}
          />
        </VStack>
      ) : email ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-gray-400">
          <p>이 이메일로 참여한 모임이 없습니다.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-gray-400">
          <p>이메일을 입력하면 참여한 모임을 볼 수 있습니다.</p>
        </div>
      )}
    </VStack>
  )
}

function EventSection({ title, events }: { title: string; events: MyEvent[] }) {
  if (events.length === 0) return null

  return (
    <div>
      <Heading level={3} size={4} className="mb-2">{title}</Heading>
      <div className="divide-y overflow-hidden rounded-lg border">
        {events.map((e) => (
          <Link
            key={`${e.id}-${e.role}`}
            to={e.role === 'admin' ? '/$eventId/admin' : '/$eventId'}
            params={{ eventId: e.id }}
            search={e.role === 'admin' && e.adminToken ? { token: e.adminToken } : {}}
            className="block px-4 py-3 hover:bg-gray-50"
          >
            <Flex align="center" justify="between">
              <HStack gap="8">
                <span className="font-medium">{e.title}</span>
                <StatusBadge status={e.status} confirmedEnd={e.confirmedEnd} />
              </HStack>
              <EventDates event={e} />
            </Flex>
          </Link>
        ))}
      </div>
    </div>
  )
}

function EventDates({ event: e }: { event: MyEvent }) {
  const fmt = (d: string) => new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })

  if (e.status === 'confirmed' && e.confirmedStart) {
    return (
      <span className="text-xs text-gray-500">
        {new Date(e.confirmedStart).toLocaleString('ko-KR', {
          month: 'short', day: 'numeric', weekday: 'short',
          hour: '2-digit', minute: '2-digit',
          timeZoneName: 'short',
        })}
      </span>
    )
  }

  return (
    <span className="text-xs text-gray-400">
      {fmt(e.eventDateStart)} ~ {fmt(e.eventDateEnd)}
    </span>
  )
}

function StatusBadge({ status, confirmedEnd }: { status: string; confirmedEnd: string | null }) {
  const isPast =
    status === 'confirmed' &&
    confirmedEnd &&
    new Date(confirmedEnd) < new Date()

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
    <Tag tone={tones[status]}>
      {labels[status] ?? status}
    </Tag>
  )
}
