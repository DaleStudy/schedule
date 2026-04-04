import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo, useEffect } from 'react'
import { dayjs } from '../../lib/time'
import { getEvent } from '../../server/functions/events'
import {
  submitAvailability,
  getParticipantSlots,
} from '../../server/functions/participants'
import {
  saveLocalEvent,
  getUserProfile,
  saveUserProfile,
} from '../../lib/local-events'
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
  const [step, setStep] = useState<'identify' | 'respond'>('identify')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState(detectedTz)
  const [nlText, setNlText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)

  const [slots, setSlots] = useState<
    Array<{ start: string; end: string; status: 'available' | 'unavailable' }>
  >([])

  // localStorage에서 프로필 자동 채움
  useEffect(() => {
    const profile = getUserProfile()
    if (profile) {
      setEmail(profile.email)
      setName(profile.name)
    }
  }, [])

  // 히트맵
  const heatmap = useMemo(() => {
    if (!event.slots || event.slots.length === 0) return undefined
    const map = new Map<string, number>()
    const SLOT_MIN = 30
    for (const slot of event.slots) {
      if (slot.status !== 'available') continue
      let cursor = dayjs.utc(slot.startAt).tz(timezone)
      const end = dayjs.utc(slot.endAt).tz(timezone)
      while (cursor.isBefore(end)) {
        const key = `${cursor.format('YYYY-MM-DD')} ${cursor.format('H:mm')}`
        map.set(key, (map.get(key) ?? 0) + 1)
        cursor = cursor.add(SLOT_MIN, 'minute')
      }
    }
    return map
  }, [event.slots, timezone])

  const heatmapMax = heatmap ? Math.max(...heatmap.values(), 1) : 1

  // Step 1: 이메일/이름 입력 후 기존 응답 로드
  const handleContinue = async () => {
    if (!email.trim() || !name.trim()) return
    setIsLoadingSlots(true)
    try {
      const result = await getParticipantSlots({
        data: { eventId: event.id, email: email.trim() },
      })
      if (result.participant) {
        setName(result.participant.name)
        if (result.participant.timezone) {
          setTimezone(result.participant.timezone)
        }
        setSlots(
          result.slots.map((s) => ({
            start: s.startAt,
            end: s.endAt,
            status: s.status as 'available' | 'unavailable',
          })),
        )
      }
      setStep('respond')
    } catch {
      setStep('respond')
    } finally {
      setIsLoadingSlots(false)
    }
  }

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
    } catch (err) {
      alert('파싱에 실패했습니다: ' + (err as Error).message)
    } finally {
      setIsParsing(false)
    }
  }

  const handleSubmit = async () => {
    if (slots.length === 0) {
      alert('가능한 시간을 최소 하나 이상 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      await submitAvailability({
        data: {
          eventId: event.id,
          email: email.trim(),
          name: name.trim(),
          timezone,
          slots: slots.map((s) => ({
            startAt: s.start,
            endAt: s.end,
            status: s.status,
          })),
        },
      })
      saveUserProfile({ name: name.trim(), email: email.trim() })
      saveLocalEvent({
        eventId: event.id,
        title: event.title,
        role: 'participant',
        name: name.trim(),
        createdAt: new Date().toISOString(),
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
          onClick={() => {
            setSubmitted(false)
            setStep('respond')
          }}
          className="text-sm text-blue-600 hover:underline"
        >
          응답 수정하기
        </button>
      </div>
    )
  }

  // Step 1: 이메일 + 이름
  if (step === 'identify') {
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
            후보 날짜:{' '}
            {new Date(event.eventDateStart).toLocaleDateString('ko-KR')} ~{' '}
            {new Date(event.eventDateEnd).toLocaleDateString('ko-KR')}
          </p>
          <p>소요 시간: {event.durationMinutes}분</p>
          <p>
            마감일:{' '}
            {new Date(event.responseDeadlineAt).toLocaleDateString('ko-KR')}
          </p>
        </div>

        <div className="space-y-4">
          <Field label="이메일">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="예: dale@example.com"
              className="input"
            />
          </Field>
          <Field label="이름">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 달레"
              className="input"
            />
          </Field>
          <button
            onClick={handleContinue}
            disabled={!email.trim() || !name.trim() || isLoadingSlots}
            className="w-full rounded bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoadingSlots ? '불러오는 중...' : '계속하기'}
          </button>
        </div>
      </div>
    )
  }

  // Step 2: 응답 입력
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {name}님 ({email})
          <button
            onClick={() => setStep('identify')}
            className="ml-2 text-blue-600 hover:underline"
          >
            변경
          </button>
        </p>
      </div>

      <div className="text-sm">
        <span className="font-medium text-gray-700">시간대: </span>
        <TimezoneSelector value={timezone} onChange={setTimezone} />
      </div>

      <Field label="가능한 시간을 알려주세요">
        <div className="flex gap-2">
          <textarea
            value={nlText}
            onChange={(e) => setNlText(e.target.value)}
            placeholder="예: 화목 오후 2-6시 가능, 주말은 안 됨"
            rows={2}
            className="input flex-1"
          />
          <button
            onClick={handleParse}
            disabled={isParsing || !nlText.trim()}
            className="shrink-0 self-end rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isParsing ? '분석 중...' : '분석'}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          실험 기능: AI 분석은 시간이 걸릴 수 있고 정확하지 않을 수 있습니다.
          결과가 맞지 않으면 아래 캘린더에서 직접 조정하세요.
        </p>
      </Field>

      <div>
        <p className="mb-2 text-xs text-gray-500">
          셀을 클릭/드래그하여 가능한 시간을 선택하세요.
          {heatmap && heatmap.size > 0 &&
            ' 파란색은 다른 참여자가 가능한 시간입니다.'}
        </p>
        <TimeGrid
          eventDateStart={event.eventDateStart}
          eventDateEnd={event.eventDateEnd}
          timezone={timezone}
          slots={slots}
          onSlotsChange={setSlots}
          heatmap={heatmap}
          heatmapMax={heatmapMax}
        />
      </div>

      {slots.length > 0 && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <p className="text-sm text-gray-700">
            {slots.filter((s) => s.status === 'available').length}개 가능,{' '}
            {slots.filter((s) => s.status === 'unavailable').length}개 불가능
          </p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || slots.length === 0}
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

