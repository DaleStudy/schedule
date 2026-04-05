import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button, TextInput, Select, Label, VStack, Heading, Text } from 'daleui'
import { createEvent } from '../server/functions/events'
import { getUserProfile, saveUserProfile } from '../lib/local-events'

export const Route = createFileRoute('/new')({
  component: CreateEventPage,
})

function CreateEventPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [eventWeeks, setEventWeeks] = useState(2)
  const [deadlineDaysBefore, setDeadlineDaysBefore] = useState(7)
  const [minParticipants, setMinParticipants] = useState('')
  const [organizerEmail, setOrganizerEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const profile = getUserProfile()
    if (profile) setOrganizerEmail(profile.email)
  }, [])
  const [result, setResult] = useState<{
    eventId: string
    adminToken: string
  } | null>(null)

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const now = new Date()
      const eventDateStart = new Date(now)
      eventDateStart.setDate(now.getDate() + 1)
      const eventDateEnd = new Date(now)
      eventDateEnd.setDate(now.getDate() + eventWeeks * 7)
      const responseDeadlineAt = new Date(eventDateStart)
      responseDeadlineAt.setDate(
        eventDateStart.getDate() - deadlineDaysBefore,
      )
      if (responseDeadlineAt <= now) {
        responseDeadlineAt.setTime(now.getTime() + 24 * 60 * 60 * 1000)
      }
      const res = await createEvent({
        data: {
          title,
          description: description || undefined,
          durationMinutes,
          timezone,
          eventDateStart: eventDateStart.toISOString(),
          eventDateEnd: eventDateEnd.toISOString(),
          responseDeadlineAt: responseDeadlineAt.toISOString(),
          minParticipants: minParticipants ? Number(minParticipants) : undefined,
          organizerEmail: organizerEmail.trim() || undefined,
        },
      })
      if (organizerEmail.trim()) {
        saveUserProfile({ email: organizerEmail.trim(), name: '' })
      }
      setResult(res)
    } catch (err) {
      alert('일정 생성에 실패했습니다: ' + (err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (result) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const respondUrl = `${baseUrl}/${result.eventId}`
    const adminUrl = `${baseUrl}/${result.eventId}/admin?token=${result.adminToken}`

    return (
      <VStack align="stretch" gap="24">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-green-800">
            일정이 생성되었습니다!
          </h2>
          <Text size="sm" tone="success">
            아래 링크를 참여자에게 공유하세요.
          </Text>
        </div>

        <VStack align="stretch" gap="16">
          <div>
            <Label labelText="참여자 공유 링크" />
            <CopyField value={respondUrl} />
            <Text size="xs" tone="neutral" className="mt-1">
              이 링크 하나로 모든 참여자가 응답할 수 있습니다.
            </Text>
          </div>

          <div>
            <Label labelText="주최자 관리 링크" />
            <CopyField value={adminUrl} />
            <Text size="xs" tone="neutral" className="mt-1">
              이 링크는 본인만 보관하세요.
            </Text>
          </div>
        </VStack>

        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/' })}>
          홈으로 돌아가기
        </Button>
      </VStack>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <VStack align="stretch" gap="24">
      <Heading level={1}>모임 만들기</Heading>

      <Field label="모임 제목">
        <TextInput
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 커피챗"
        />
      </Field>

      <Field label="모임 시간">
        <Select
          value={String(durationMinutes)}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
        >
          <option value="30">30분</option>
          <option value="60">1시간</option>
          <option value="90">1시간 30분</option>
          <option value="120">2시간</option>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="목표 기간">
          <Select
            value={String(eventWeeks)}
            onChange={(e) => setEventWeeks(Number(e.target.value))}
          >
            <option value="1">1주 내</option>
            <option value="2">2주 내</option>
            <option value="3">3주 내</option>
            <option value="4">4주 내</option>
          </Select>
        </Field>
        <Field label="응답 마감">
          <Select
            value={String(deadlineDaysBefore)}
            onChange={(e) => setDeadlineDaysBefore(Number(e.target.value))}
          >
            <option value="3">3일 전 확정</option>
            <option value="5">5일 전 확정</option>
            <option value="7">1주 전 확정</option>
            <option value="14">2주 전 확정</option>
          </Select>
          <Text size="xs" tone="neutral" className="mt-1">
            모임 시작일 기준으로 이 기간 전에 자동 확정됩니다.
          </Text>
        </Field>
      </div>

      <Field label="최소 인원 (선택)">
        <TextInput
          type="number"
          min={2}
          value={minParticipants}
          onChange={(e) => setMinParticipants(e.target.value)}
          placeholder="미설정 시 인원 제한 없음"
        />
        <Text size="xs" tone="neutral" className="mt-1">
          이 인원 미만이면 모임이 성사되지 않습니다.
        </Text>
      </Field>

      <Field label="내 이메일 (선택)">
        <TextInput
          type="email"
          value={organizerEmail}
          onChange={(e) => setOrganizerEmail(e.target.value)}
          placeholder="입력하면 모임 목록에서 조회 가능"
        />
      </Field>

      <Field label="설명 (선택)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="모임에 대한 설명을 입력하세요"
          rows={2}
          className="input"
        />
      </Field>

      <Button type="submit" fullWidth loading={isSubmitting}>
        {isSubmitting ? '생성 중...' : '일정 생성'}
      </Button>
      </VStack>
    </form>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label labelText={label} />
      {children}
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
