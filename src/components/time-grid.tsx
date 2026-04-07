import { useState, useCallback, useRef } from 'react'
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

const HOURS_START = 6
const HOURS_END = 24
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
  const [dragStatus, setDragStatus] = useState<'available' | undefined>(
    'available',
  )
  const lastTouchCell = useRef<string | null>(null)

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

  // 슬롯 상태 맵: "YYYY-MM-DD H:mm" -> status (H = 패딩 없음, timeLabels와 일치)
  const slotStatusMap = new Map<string, 'available' | 'unavailable'>()
  for (const slot of slots) {
    const start = dayjs.utc(slot.start).tz(timezone)
    const end = dayjs.utc(slot.end).tz(timezone)
    let c = start
    while (c.isBefore(end)) {
      slotStatusMap.set(c.format('YYYY-MM-DD H:mm'), slot.status)
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

      // 기존 슬롯에서 이 셀에 해당하는 부분 제거 (멀티시간 슬롯도 분할 처리)
      const cellStartDjs = dayjs
        .tz(`${day} ${time}`, 'YYYY-MM-DD H:mm', timezone)
        .utc()
      const cellEndDjs = cellStartDjs.add(SLOT_MINUTES, 'minute')
      const cellStart = cellStartDjs.toISOString()
      const cellEnd = cellEndDjs.toISOString()

      const filtered: TimeSlot[] = []
      for (const s of slots) {
        const sStart = dayjs.utc(s.start)
        const sEnd = dayjs.utc(s.end)
        if (cellStartDjs.isBefore(sEnd) && cellEndDjs.isAfter(sStart)) {
          // 이 슬롯이 해당 셀을 포함 → 셀 앞/뒤를 잔여 슬롯으로 분할
          if (sStart.isBefore(cellStartDjs)) {
            filtered.push({ start: s.start, end: cellStart, status: s.status })
          }
          if (sEnd.isAfter(cellEndDjs)) {
            filtered.push({ start: cellEnd, end: s.end, status: s.status })
          }
        } else {
          filtered.push(s)
        }
      }

      if (newStatus) {
        filtered.push({ start: cellStart, end: cellEnd, status: newStatus })
      }

      onSlotsChange(filtered)
    },
    [slots, onSlotsChange, timezone, readOnly, slotStatusMap],
  )

  const handleCellAction = (day: string, time: string, isStart: boolean) => {
    if (readOnly) return
    if (isStart) {
      const current = getCellStatus(day, time)
      const nextStatus: 'available' | undefined =
        current === 'available' ? undefined : 'available'
      setDragStatus(nextStatus)
      setIsDragging(true)
      toggleCell(day, time, nextStatus)
    } else if (isDragging) {
      if (dragStatus === undefined) {
        if (getCellStatus(day, time) === 'available') {
          toggleCell(day, time)
        }
      } else {
        toggleCell(day, time, dragStatus)
      }
    }
  }

  const handleMouseUp = () => setIsDragging(false)

  // 터치: elementFromPoint로 손가락 아래 셀을 찾음
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || readOnly) return
      e.preventDefault()
      const touch = e.touches[0]
      const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null
      if (!el?.dataset.day || !el?.dataset.time) return
      const cellKey = `${el.dataset.day} ${el.dataset.time}`
      if (cellKey === lastTouchCell.current) return
      lastTouchCell.current = cellKey
      handleCellAction(el.dataset.day, el.dataset.time, false)
    },
    [isDragging, readOnly, dragStatus, toggleCell, getCellStatus],
  )

  const handleTouchEnd = () => {
    setIsDragging(false)
    lastTouchCell.current = null
  }

  // 최소 열 너비 확보: 일 수가 많으면 테이블이 넓어짐
  const minTableWidth = days.length > 7 ? `${days.length * 44 + 48}px` : undefined

  return (
    <div
      className="select-none overflow-x-auto -mx-4 px-4"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchEnd={handleTouchEnd}
    >
      <table
        className="w-full table-fixed border-collapse text-xs"
        style={{ minWidth: minTableWidth }}
      >
        <colgroup>
          <col style={{ width: '3rem' }} />
        </colgroup>
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
                const hasSelections = slots.length > 0
                const heatCount = heatmap?.get(getCellKey(day, time)) ?? 0
                const heatOpacity =
                  heatmap && heatmapMax > 0 && !status
                    ? Math.round((heatCount / heatmapMax) * 40 + 10)
                    : 0
                return (
                  <td
                    key={`${day}-${time}`}
                    data-day={day}
                    data-time={time}
                    className={`cursor-pointer border p-0 ${
                      status === 'available'
                        ? 'bg-green-400 hover:bg-green-500'
                        : hasSelections && !heatCount
                          ? 'bg-red-50 hover:bg-red-100'
                          : 'hover:bg-gray-100'
                    } ${time.endsWith(':00') ? 'border-t-gray-300' : 'border-t-gray-100'}`}
                    style={{
                      height: 24,
                      backgroundColor:
                        !status && heatCount > 0
                          ? `rgba(59, 130, 246, ${heatOpacity / 100})`
                          : undefined,
                    }}
                    title={heatCount > 0 ? `${heatCount}명 가능` : undefined}
                    onMouseDown={() => handleCellAction(day, time, true)}
                    onMouseEnter={() => handleCellAction(day, time, false)}
                    onTouchStart={() => handleCellAction(day, time, true)}
                    onTouchMove={handleTouchMove}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-green-400" /> 가능
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-50 border border-red-200" /> 불가
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
