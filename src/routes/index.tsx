import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button, Tag, VStack, Flex, HStack, Heading, TextInput } from 'daleui'
import { getUserProfile, saveUserProfile } from '../lib/local-events'
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
        <div className="divide-y overflow-hidden rounded-lg border">
          {myEvents.map((e) => (
            <Link
              key={`${e.id}-${e.role}`}
              to={
                e.role === 'admin'
                  ? `/${e.id}/admin`
                  : `/${e.id}`
              }
              search={e.role === 'admin' && e.adminToken ? { token: e.adminToken } : {}}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <HStack gap="8">
                <span className="font-medium">{e.title}</span>
                <span className="text-xs text-gray-400">
                  {e.role === 'admin' ? '주최' : '참여'}
                </span>
                <StatusBadge status={e.status} confirmedEnd={e.confirmedEnd} />
              </HStack>
              <span className="text-xs text-gray-400">
                {new Date(e.createdAt).toLocaleDateString('ko-KR')}
              </span>
            </Link>
          ))}
        </div>
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
