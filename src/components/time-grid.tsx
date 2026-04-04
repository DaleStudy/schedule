import { useState, useCallback } from 'react'
import { dayjs } from '../lib/time'

interface TimeSlot {
  start: string
  end: string
  status: 'available' | 'unavailable'
}

interface TimeGridProps {
  eventDateStart: string
  eventDateEnd: string
  timezone: string
  slots: TimeSlot[]
  onSlotsChange: (slots: TimeSlot[]) => void
  readOnly?: boolean
  heatmap?: Map<string, number>
  heatmapMax?: number
}

const HOURS_START = 9
const HOURS_END = 22
const SLOT_MINUTES = 30

export function TimeGrid({
  eventDateStart,
  eventDateEnd,
  timezone,
  slots,
  onSlotsChange,
  readOnly = false,
  heatmap,
  heatmapMax = 1,
}: TimeGridProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStatus, setDragStatus] = useState<
    'available' | 'unavailable' | undefined
  >('available')

  // 날짜 범위에서 각 날짜 생성
  const days: string[] = []
  let cursor = dayjs.utc(eventDateStart).tz(timezone).startOf('day')
  const end = dayjs.utc(eventDateEnd).tz(timezone).startOf('day')
  while (!cursor.isAfter(end)) {
    days.push(cursor.format('YYYY-MM-DD'))
    cursor = cursor.add(1, 'day')
  }

  // 시간 슬롯 생성 (30분 단위)
  const timeLabels: string[] = []
  for (let h = HOURS_START; h < HOURS_END; h++) {
    timeLabels.push(`${h}:00`)
    timeLabels.push(`${h}:30`)
  }

  // 슬롯 상태 맵: "YYYY-MM-DD HH:mm" -> status
  const slotStatusMap = new Map<string, 'available' | 'unavailable'>()
  for (const slot of slots) {
    const start = dayjs.utc(slot.start).tz(timezone)
    const end = dayjs.utc(slot.end).tz(timezone)
    let c = start
    while (c.isBefore(end)) {
      slotStatusMap.set(c.format('YYYY-MM-DD HH:mm'), slot.status)
      c = c.add(SLOT_MINUTES, 'minute')
    }
  }

  const getCellKey = (day: string, time: string) => `${day} ${time}`

  const getCellStatus = (day: string, time: string) =>
    slotStatusMap.get(getCellKey(day, time))

  const toggleCell = useCallback(
    (day: string, time: string, forceStatus?: 'available' | 'unavailable') => {
      if (readOnly) return

      const key = getCellKey(day, time)
      const current = slotStatusMap.get(key)
      const newStatus = forceStatus ?? (current === 'available' ? undefined : 'available')

      // 기존 슬롯에서 이 셀에 해당하는 항목 제거
      const cellStart = dayjs
        .tz(`${day} ${time}`, 'YYYY-MM-DD H:mm', timezone)
        .utc()
        .toISOString()
      const cellEnd = dayjs
        .tz(`${day} ${time}`, 'YYYY-MM-DD H:mm', timezone)
        .add(SLOT_MINUTES, 'minute')
        .utc()
        .toISOString()

      const filtered = slots.filter(
        (s) => !(s.start === cellStart && s.end === cellEnd),
      )

      if (newStatus) {
        filtered.push({ start: cellStart, end: cellEnd, status: newStatus })
      }

      onSlotsChange(filtered)
    },
    [slots, onSlotsChange, timezone, readOnly, slotStatusMap],
  )

  const handleMouseDown = (day: string, time: string) => {
    if (readOnly) return
    const current = getCellStatus(day, time)
    // 3단계 토글: 미입력 → 가능 → 불가능 → 미입력
    const nextStatus: 'available' | 'unavailable' | undefined =
      current === undefined ? 'available'
      : current === 'available' ? 'unavailable'
      : undefined
    setDragStatus(nextStatus ?? 'available')
    setIsDragging(true)
    toggleCell(day, time, nextStatus)
  }

  const handleMouseEnter = (day: string, time: string) => {
    if (!isDragging || readOnly) return
    toggleCell(day, time, dragStatus)
  }

  const handleMouseUp = () => setIsDragging(false)

  return (
    <div
      className="select-none overflow-x-auto"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-2 py-1" />
            {days.map((day) => (
              <th
                key={day}
                className="border-b px-1 py-2 text-center font-medium"
              >
                <div>{dayjs(day).format('M/D')}</div>
                <div className="text-gray-400">
                  {dayjs(day).format('ddd')}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeLabels.map((time) => (
            <tr key={time}>
              <td className="sticky left-0 z-10 bg-white px-2 py-0 text-right text-gray-500">
                {time.endsWith(':00') ? time : ''}
              </td>
              {days.map((day) => {
                const status = getCellStatus(day, time)
                const heatCount = heatmap?.get(getCellKey(day, time)) ?? 0
                const heatOpacity =
                  heatmap && heatmapMax > 0 && !status
                    ? Math.round((heatCount / heatmapMax) * 40 + 10)
                    : 0
                return (
                  <td
                    key={`${day}-${time}`}
                    className={`cursor-pointer border p-0 ${
                      status === 'available'
                        ? 'bg-green-400 hover:bg-green-500'
                        : status === 'unavailable'
                          ? 'bg-red-300 hover:bg-red-400'
                          : 'hover:bg-gray-100'
                    } ${time.endsWith(':00') ? 'border-t-gray-300' : 'border-t-gray-100'}`}
                    style={{
                      height: 20,
                      backgroundColor:
                        !status && heatCount > 0
                          ? `rgba(59, 130, 246, ${heatOpacity / 100})`
                          : undefined,
                    }}
                    title={heatCount > 0 ? `${heatCount}명 가능` : undefined}
                    onMouseDown={() => handleMouseDown(day, time)}
                    onMouseEnter={() => handleMouseEnter(day, time)}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-green-400" /> 가능
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-300" /> 불가능
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-gray-50 border" />{' '}
          미입력
        </span>
        {heatmap && (
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded"
              style={{ backgroundColor: 'rgba(59, 130, 246, 0.35)' }}
            />{' '}
            다른 참여자
          </span>
        )}
      </div>
    </div>
  )
}
