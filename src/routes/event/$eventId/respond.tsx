import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getParticipantByToken, submitAvailability } from '../../../server/functions/participants'
import { parseAvailabilityText, type ParsedSlot } from '../../../server/functions/parse-availability'
import { TimeGrid } from '../../../components/time-grid'
import { TimezoneSelector } from '../../../components/timezone-selector'

interface RespondSearch {
  token: string
}

export const Route = createFileRoute('/event/$eventId/respond')({
  validateSearch: (search: Record<string, unknown>): RespondSearch => ({
    token: (search.token as string) || '',
  }),
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ deps }) => {
    return getParticipantByToken({ data: { token: deps.token } })
  },
  component: RespondPage,
})

function RespondPage() {
  const { participant, event, existingSlots } = Route.useLoaderData()
  const { token } = Route.useSearch()

  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [timezone, setTimezone] = useState(participant.timezone || detectedTz)
  const [nlText, setNlText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(!!participant.respondedAt)
  const [activeTab, setActiveTab] = useState<'nl' | 'grid'>('nl')

  const [slots, setSlots] = useState<
    Array<{ start: string; end: string; status: 'available' | 'unavailable' }>
  >(
    existingSlots.map((s) => ({
      start: s.startAt,
      end: s.endAt,
      status: s.status as 'available' | 'unavailable',
    })),
  )

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
    if (slots.length === 0) {
      alert('가능한 시간을 최소 하나 이상 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      await submitAvailability({
        data: {
          participantToken: token,
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

  if (event.status !== 'pending') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
          <p className="text-gray-600">
            이 일정은 이미{' '}
            {event.status === 'confirmed' ? '확정' : '취소'}되었습니다.
          </p>
          <a
            href={`/event/${event.id}`}
            className="mt-2 inline-block text-blue-600 hover:underline"
          >
            일정 상태 확인하기
          </a>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-green-800">
            응답이 제출되었습니다!
          </h2>
          <p className="text-sm text-green-700">
            모든 참여자가 응답하거나 마감일이 되면 최적 시간이 자동으로
            확정됩니다.
          </p>
          <a
            href={`/event/${event.id}`}
            className="mt-3 inline-block text-green-600 hover:underline"
          >
            일정 상태 확인하기
          </a>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {participant.name}님, 가능한 시간을 알려주세요.
        </p>
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

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          타임존
        </label>
        <TimezoneSelector value={timezone} onChange={setTimezone} />
      </div>

      {/* Tab 전환 */}
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

      {/* 자연어 입력 탭 */}
      {activeTab === 'nl' && (
        <div className="space-y-3">
          <textarea
            value={nlText}
            onChange={(e) => setNlText(e.target.value)}
            placeholder={`예시:\n- 다음주 화목 오후 2시~6시 가능해요\n- 수요일은 하루종일 안돼요\n- 4월 15일이랑 17일 오전 괜찮습니다`}
            rows={5}
            className="input"
          />
          <button
            onClick={handleParse}
            disabled={isParsing || !nlText.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isParsing ? '분석 중...' : '시간 분석하기'}
          </button>
          {isParsing && (
            <p className="text-xs text-gray-500">
              AI가 텍스트를 분석하고 있습니다...
            </p>
          )}
        </div>
      )}

      {/* 캘린더 그리드 탭 (항상 프리뷰로도 표시) */}
      {activeTab === 'grid' && (
        <div>
          <p className="mb-2 text-xs text-gray-500">
            셀을 클릭/드래그하여 가능한 시간을 선택하세요. 초록색 = 가능, 빨간색
            = 불가능
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

      {/* 선택된 슬롯 요약 */}
      {slots.length > 0 && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <h3 className="mb-1 text-sm font-medium text-gray-700">
            선택된 시간 ({slots.filter((s) => s.status === 'available').length}개
            가능,{' '}
            {slots.filter((s) => s.status === 'unavailable').length}개 불가능)
          </h3>
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
        disabled={isSubmitting || slots.length === 0}
        className="w-full rounded bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {isSubmitting ? '제출 중...' : '응답 제출하기'}
      </button>
    </div>
  )
}
