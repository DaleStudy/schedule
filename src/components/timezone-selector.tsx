interface TimezoneSelectorProps {
  value: string
  onChange: (tz: string) => void
}

const COMMON_TIMEZONES = [
  { value: 'Asia/Seoul', label: '서울 (KST, UTC+9)' },
  { value: 'Asia/Tokyo', label: '도쿄 (JST, UTC+9)' },
  { value: 'Asia/Shanghai', label: '상하이 (CST, UTC+8)' },
  { value: 'America/New_York', label: '뉴욕 (EST, UTC-5)' },
  { value: 'America/Los_Angeles', label: 'LA (PST, UTC-8)' },
  { value: 'America/Chicago', label: '시카고 (CST, UTC-6)' },
  { value: 'Europe/London', label: '런던 (GMT, UTC+0)' },
  { value: 'Europe/Paris', label: '파리 (CET, UTC+1)' },
  { value: 'Europe/Berlin', label: '베를린 (CET, UTC+1)' },
  { value: 'Australia/Sydney', label: '시드니 (AEST, UTC+10)' },
  { value: 'Pacific/Auckland', label: '오클랜드 (NZST, UTC+12)' },
]

export function TimezoneSelector({ value, onChange }: TimezoneSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input"
    >
      {COMMON_TIMEZONES.map((tz) => (
        <option key={tz.value} value={tz.value}>
          {tz.label}
        </option>
      ))}
      {!COMMON_TIMEZONES.find((tz) => tz.value === value) && (
        <option value={value}>{value}</option>
      )}
    </select>
  )
}
