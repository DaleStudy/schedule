import { Text } from 'daleui'

interface TimezoneConversionsProps {
  start: string
  end: string
  participantTimezones: (string | null)[]
}

export function TimezoneConversions({
  start,
  end,
  participantTimezones,
}: TimezoneConversionsProps) {
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone

  // 참여자 시간대에서 현재 사용자 시간대를 제외한 고유 목록
  const otherTimezones = [
    ...new Set(
      participantTimezones.filter(
        (tz): tz is string => tz != null && tz !== localTz,
      ),
    ),
  ].sort()

  if (otherTimezones.length === 0) return null

  const formatTime = (dateStr: string, tz: string) =>
    new Date(dateStr).toLocaleString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    })

  const formatEndTime = (dateStr: string, tz: string) =>
    new Date(dateStr).toLocaleString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
      timeZoneName: 'short',
    })

  // 시간대에서 도시명 추출 (예: Asia/Seoul → Seoul)
  const cityName = (tz: string) => tz.split('/').pop()?.replace(/_/g, ' ') ?? tz

  return (
    <div className="mt-2 space-y-0.5">
      <Text size="xs" tone="neutral" weight="medium">
        다른 참여자 시간대
      </Text>
      {otherTimezones.map((tz) => (
        <Text key={tz} size="xs" tone="neutral">
          {cityName(tz)}: {formatTime(start, tz)} ~ {formatEndTime(end, tz)}
        </Text>
      ))}
    </div>
  )
}
