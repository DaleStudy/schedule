import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo, useEffect } from 'react'
import { Button, TextInput, Label, Card, VStack, HStack, Heading, Text } from 'daleui'
import { dayjs } from '../../lib/time'
import { getEvent } from '../../server/functions/events'
import {
  submitAvailability,
  getParticipantSlots,
} from '../../server/functions/participants'
import {
  getUserProfile,
  saveUserProfile,
} from '../../lib/local-events'
import { parseAvailabilityText } from '../../server/functions/parse-availability'
import { TimeGrid } from '../../components/time-grid'
import { TimezoneSelector } from '../../components/timezone-selector'

export const Route = createFileRoute('/$eventId/')({
  loader: async ({ params }) => {
    return getEvent({ data: { eventId: params.eventId } })
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    return {
      meta: [
        { title: `${loaderData.title} - DaleSchedule` },
        { property: 'og:title', content: loaderData.title },
        { property: 'og:description', content: `${loaderData.durationMinutes}분 모임 | 가능한 시간을 알려주세요` },
      ],
    }
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
  const [isEditing, setIsEditing] = useState(false)

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
        setIsEditing(true)
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
      <VStack align="stretch" gap="24">
        <Heading level={1}>{event.title}</Heading>
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
      </VStack>
    )
  }

  if (event.status === 'cancelled') {
    return (
      <VStack align="stretch" gap="16">
        <Heading level={1}>{event.title}</Heading>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <Text tone="danger">
            참여 가능한 공통 시간을 찾을 수 없어 일정이 취소되었습니다.
          </Text>
        </div>
      </VStack>
    )
  }

  // 제출 완료
  if (submitted) {
    return (
      <VStack align="stretch" gap="16">
        <Heading level={1}>{event.title}</Heading>
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-green-800">
            응답이 제출되었습니다!
          </h2>
          <Text size="sm" tone="success">
            응답 마감일이 되면 최적 시간이 자동으로 확정됩니다.
          </Text>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSubmitted(false)
            setStep('respond')
          }}
        >
          응답 수정
        </Button>
      </VStack>
    )
  }

  // Step 1: 이메일 + 이름
  if (step === 'identify') {
    return (
      <VStack align="stretch" gap="24">
        <div>
          <Heading level={1}>{event.title}</Heading>
          {event.description && (
            <Text tone="neutral" className="mt-1">{event.description}</Text>
          )}
        </div>

        <Card outline>
          <Card.Body>
            <Text size="sm" tone="neutral">
              목표 기간: {new Date(event.eventDateStart).toLocaleDateString('ko-KR')} ~ {new Date(event.eventDateEnd).toLocaleDateString('ko-KR')}
            </Text>
            <Text size="sm" tone="neutral">소요 시간: {event.durationMinutes}분</Text>
            <Text size="sm" tone="neutral">
              응답 마감: {new Date(event.responseDeadlineAt).toLocaleDateString('ko-KR')}
            </Text>
          </Card.Body>
        </Card>

        <VStack align="stretch" gap="16">
          <Field label="이메일">
            <TextInput
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="예: dale@example.com"
            />
          </Field>
          <Field label="이름">
            <TextInput
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 달레"
            />
          </Field>
          <Button
            fullWidth
            onClick={handleContinue}
            disabled={!email.trim() || !name.trim() || isLoadingSlots}
            loading={isLoadingSlots}
          >
            {isLoadingSlots ? '불러오는 중...' : '계속'}
          </Button>
        </VStack>
      </VStack>
    )
  }

  // Step 2: 응답 입력
  return (
    <VStack align="stretch" gap="24">
      <div>
        <Heading level={1}>{event.title}</Heading>
        <p className="mt-1 text-sm text-gray-500">
          {name}님 ({email})
          <Button variant="ghost" size="sm" onClick={() => setStep('identify')}>
            변경
          </Button>
        </p>
        {isEditing && (
          <Text size="sm" tone="info" className="mt-2">
            이전에 제출한 응답을 수정합니다.
          </Text>
        )}
      </div>

      <div className="text-sm">
        <Text as="span" weight="medium" tone="neutral">시간대: </Text>
        <TimezoneSelector value={timezone} onChange={setTimezone} />
      </div>

      <Field label="가능한 시간을 알려주세요">
        <HStack gap="8">
          <textarea
            value={nlText}
            onChange={(e) => setNlText(e.target.value)}
            placeholder="예: 화목 오후 2-6시 가능, 주말은 안 됨"
            rows={2}
            className="input flex-1"
          />
          <Button
            size="sm"
            onClick={handleParse}
            disabled={isParsing || !nlText.trim()}
            loading={isParsing}
            className="shrink-0 self-end"
          >
            {isParsing ? '분석 중...' : '분석'}
          </Button>
        </HStack>
        <Text size="xs" tone="neutral" className="mt-1">
          실험 기능: AI 분석은 시간이 걸릴 수 있고 정확하지 않을 수 있습니다.
          결과가 맞지 않으면 아래 캘린더에서 직접 조정하세요.
        </Text>
      </Field>

      <div>
        <Text size="xs" tone="neutral" className="mb-2">
          셀을 클릭/드래그하여 가능한 시간을 선택하세요.
          {heatmap && heatmap.size > 0 &&
            ' 파란색은 다른 참여자가 가능한 시간이며, 진할수록 더 많은 참여자가 가능합니다.'}
        </Text>
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
        <Card outline>
          <Card.Body>
            <Text size="sm" tone="neutral">
              {slots.filter((s) => s.status === 'available').length}개 시간대 선택됨
            </Text>
          </Card.Body>
        </Card>
      )}

      <Button
        fullWidth
        onClick={handleSubmit}
        disabled={isSubmitting || slots.length === 0}
        loading={isSubmitting}
      >
        {isSubmitting ? '제출 중...' : isEditing ? '응답 수정' : '응답 제출'}
      </Button>
    </VStack>
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

