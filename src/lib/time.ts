import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

export { dayjs }

export function toUTC(date: string | Date, tz?: string): string {
  if (tz) {
    return dayjs.tz(date, tz).utc().toISOString()
  }
  return dayjs(date).utc().toISOString()
}

export function fromUTC(utcDate: string, tz: string): string {
  return dayjs.utc(utcDate).tz(tz).format('YYYY-MM-DD HH:mm')
}

export function nowUTC(): string {
  return dayjs.utc().toISOString()
}

export function formatDateTimeForDisplay(utcDate: string, tz: string): string {
  return dayjs.utc(utcDate).tz(tz).format('M월 D일 (ddd) HH:mm')
}
