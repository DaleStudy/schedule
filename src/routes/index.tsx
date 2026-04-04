import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { createEvent } from '../server/functions/events'

export const Route = createFileRoute('/')({
  component: CreateEventPage,
})

function CreateEventPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [eventWeeks, setEventWeeks] = useState(2)
  const [deadlineDaysBefore, setDeadlineDaysBefore] = useState(7)
  const [participantNames, setParticipantNames] = useState([''])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{
    eventId: string
    adminToken: string
    participants: Array<{ name: string; token: string }>
  } | null>(null)

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const addParticipant = () => setParticipantNames([...participantNames, ''])
  const removeParticipant = (idx: number) =>
    setParticipantNames(participantNames.filter((_, i) => i !== idx))
  const updateParticipant = (idx: number, name: string) => {
    const updated = [...participantNames]
    updated[idx] = name
    setParticipantNames(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const names = participantNames.filter((n) => n.trim())
      const now = new Date()
      const eventDateStart = new Date(now)
      eventDateStart.setDate(now.getDate() + 1)
      const eventDateEnd = new Date(now)
      eventDateEnd.setDate(now.getDate() + eventWeeks * 7)
      const responseDeadlineAt = new Date(eventDateStart)
      responseDeadlineAt.setDate(eventDateStart.getDate() - deadlineDaysBefore)
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
          participantNames: names,
        },
      })
      setResult(res)
    } catch (err) {
      alert('일정 생성에 실패했습니다: ' + (err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (result) {
    const baseUrl = window.location.origin
    const adminUrl = `${baseUrl}/event/${result.eventId}/admin?token=${result.adminToken}`

    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-green-800">
            일정이 생성되었습니다!
          </h2>
          <p className="text-sm text-green-700">
            아래 링크를 참여자에게 공유하세요.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              주최자 관리 링크
            </label>
            <CopyField value={adminUrl} />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              참여자별 응답 링크
            </h3>
            <div className="space-y-2">
              {result.participants.map((p) => (
                <div key={p.token} className="flex items-center gap-2">
                  <span className="w-24 truncate text-sm font-medium">
                    {p.name}
                  </span>
                  <CopyField
                    value={`${baseUrl}/event/${result.eventId}/respond?token=${p.token}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate({ to: `/event/${result.eventId}/admin`, search: { token: result.adminToken } })}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          관리 대시보드로 이동
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-2xl font-bold">새 모임 일정 만들기</h1>

      <Field label="모임 제목">
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 4월 팀 회의"
          className="input"
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

      <Field label="모임 시간">
        <select
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
          className="input"
        >
          <option value={30}>30분</option>
          <option value={60}>1시간</option>
          <option value={90}>1시간 30분</option>
          <option value={120}>2시간</option>
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="모임 가능 기간">
          <select
            value={eventWeeks}
            onChange={(e) => setEventWeeks(Number(e.target.value))}
            className="input"
          >
            <option value={1}>1주 내</option>
            <option value={2}>2주 내</option>
            <option value={3}>3주 내</option>
            <option value={4}>4주 내</option>
          </select>
        </Field>
        <Field label="응답 마감">
          <select
            value={deadlineDaysBefore}
            onChange={(e) => setDeadlineDaysBefore(Number(e.target.value))}
            className="input"
          >
            <option value={3}>3일 전 확정</option>
            <option value={5}>5일 전 확정</option>
            <option value={7}>1주 전 확정</option>
            <option value={14}>2주 전 확정</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            모임 시작일 기준으로 이 기간 전에 자동 확정됩니다.
          </p>
        </Field>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          참여자
        </label>
        <div className="space-y-2">
          {participantNames.map((name, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => updateParticipant(idx, e.target.value)}
                placeholder={`참여자 ${idx + 1} 이름`}
                className="input flex-1"
              />
              {participantNames.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeParticipant(idx)}
                  className="rounded px-3 text-red-500 hover:bg-red-50"
                >
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addParticipant}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
        >
          + 참여자 추가
        </button>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? '생성 중...' : '일정 생성'}
      </button>
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
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
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
    <div className="flex flex-1 items-center gap-2 rounded border bg-gray-50 px-3 py-2">
      <span className="flex-1 truncate text-xs text-gray-600">{value}</span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800"
      >
        {copied ? '복사됨!' : '복사'}
      </button>
    </div>
  )
}
