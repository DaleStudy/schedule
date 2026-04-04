import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getEvent } from '../../server/functions/events'
import { submitAvailability } from '../../server/functions/participants'
import {
  parseAvailabilityText,
  type ParsedSlot,
} from '../../server/functions/parse-availability'
import { TimeGrid } from '../../components/time-grid'
import { TimezoneSelector } from '../../components/timezone-selector'

export const Route = createFileRoute('/$eventId/')({
  loader: async ({ params }) => {
    return getEvent({ data: { eventId: params.eventId } })
  },
  component: RespondPage,
})

function RespondPage() {
  const event = Route.useLoaderData()

  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState(detectedTz)
  const [nlText, setNlText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [activeTab, setActiveTab] = useState<'nl' | 'grid'>('nl')

  const [slots, setSlots] = useState<
    Array<{ start: string; end: string; status: 'available' | 'unavailable' }>
  >([])

  const handleParse = async () => {
    if (!nlText.trim()) return
    setIsParsing(true)
    try {
      const parsed = await parseAvailabilityText({
        data: {
          text: nlText,
          eventDateStart: event.eventDateStart,
          eventDateEnd: event.eventDateEnd,
          participantTimezone: timezone,
        },
      })
      setSlots(parsed)
      setActiveTab('grid')
    } catch (err) {
      alert('파싱에 실패했습니다: ' + (err as Error).message)
    } finally {
      setIsParsing(false)
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('이름을 입력해주세요.')
      return
    }
    if (slots.length === 0) {
      alert('가능한 시간을 최소 하나 이상 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      await submitAvailability({
        data: {
          eventId: event.id,
          name: name.trim(),
          timezone,
          slots: slots.map((s) => ({
            startAt: s.start,
            endAt: s.end,
            status: s.status,
          })),
        },
      })
      setSubmitted(true)
    } catch (err) {
      alert('제출에 실패했습니다: ' + (err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 확정/취소된 이벤트
  if (event.status === 'confirmed' && event.confirmedStart) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{event.title}</h1>
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
        <ParticipantList participants={event.participants} />
      </div>
    )
  }

  if (event.status === 'cancelled') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-red-700">
            참여 가능한 공통 시간을 찾을 수 없어 일정이 취소되었습니다.
          </p>
        </div>
      </div>
    )
  }

  // 제출 완료
  if (submitted) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-green-800">
            응답이 제출되었습니다!
          </h2>
          <p className="text-sm text-green-700">
            응답 마감일이 되면 최적 시간이 자동으로 확정됩니다.
          </p>
        </div>
        <button
          onClick={() => setSubmitted(false)}
          className="text-sm text-blue-600 hover:underline"
        >
          응답 수정하기
        </button>
      </div>
    )
  }

  // 응답 폼
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        {event.description && (
          <p className="mt-1 text-gray-600">{event.description}</p>
        )}
      </div>

      <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
        <p>
          모임 가능 기간:{' '}
          {new Date(event.eventDateStart).toLocaleDateString('ko-KR')} ~{' '}
          {new Date(event.eventDateEnd).toLocaleDateString('ko-KR')}
        </p>
        <p>모임 시간: {event.durationMinutes}분</p>
        <p>
          응답 마감:{' '}
          {new Date(event.responseDeadlineAt).toLocaleDateString('ko-KR')}
        </p>
      </div>

      {event.participants.length > 0 && (
        <ParticipantList participants={event.participants} />
      )}

      <Field label="이름">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름을 입력하세요"
          className="input"
        />
      </Field>

      <div className="text-sm">
        <span className="font-medium text-gray-700">시간대: </span>
        <TimezoneSelector value={timezone} onChange={setTimezone} />
      </div>

      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('nl')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'nl'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          자연어로 입력
        </button>
        <button
          onClick={() => setActiveTab('grid')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'grid'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          캘린더에서 선택
        </button>
      </div>

      {activeTab === 'nl' && (
        <div className="space-y-3">
          <textarea
            value={nlText}
            onChange={(e) => setNlText(e.target.value)}
            placeholder={`예시:\n- 다음주 화목 오후 2시~6시 가능해요\n- 수요일은 하루종일 안돼요`}
            rows={4}
            className="input"
          />
          <button
            onClick={handleParse}
            disabled={isParsing || !nlText.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isParsing ? '분석 중...' : '시간 분석하기'}
          </button>
        </div>
      )}

      {activeTab === 'grid' && (
        <div>
          <p className="mb-2 text-xs text-gray-500">
            셀을 클릭/드래그하여 가능한 시간을 선택하세요.
          </p>
          <TimeGrid
            eventDateStart={event.eventDateStart}
            eventDateEnd={event.eventDateEnd}
            timezone={timezone}
            slots={slots}
            onSlotsChange={setSlots}
          />
        </div>
      )}

      {slots.length > 0 && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <p className="text-sm text-gray-700">
            {slots.filter((s) => s.status === 'available').length}개 가능,{' '}
            {slots.filter((s) => s.status === 'unavailable').length}개 불가능
          </p>
          {activeTab === 'nl' && (
            <button
              onClick={() => setActiveTab('grid')}
              className="mt-1 text-xs text-blue-600 hover:underline"
            >
              캘린더에서 확인/수정하기
            </button>
          )}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || slots.length === 0 || !name.trim()}
        className="w-full rounded bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {isSubmitting ? '제출 중...' : '응답 제출하기'}
      </button>
    </div>
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

function ParticipantList({
  participants,
}: {
  participants: Array<{ name: string; respondedAt: string | null }>
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-gray-700">
        응답 현황 ({participants.filter((p) => p.respondedAt).length}/
        {participants.length}명)
      </h3>
      <div className="divide-y rounded-lg border">
        {participants.map((p) => (
          <div
            key={p.name}
            className="flex items-center justify-between px-4 py-2"
          >
            <span className="text-sm font-medium">{p.name}</span>
            <span
              className={`text-xs ${p.respondedAt ? 'text-green-600' : 'text-gray-400'}`}
            >
              {p.respondedAt ? '응답 완료' : '대기 중'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
