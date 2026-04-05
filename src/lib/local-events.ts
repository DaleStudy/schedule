const STORAGE_KEY = 'dale-schedule-events'

export interface LocalEvent {
  eventId: string
  title?: string
  role: 'admin' | 'participant'
  adminToken?: string
  name?: string
  createdAt: string
}

export function getLocalEvents(): LocalEvent[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveLocalEvent(event: LocalEvent) {
  const events = getLocalEvents()
  const existing = events.findIndex((e) => e.eventId === event.eventId && e.role === event.role)
  if (existing >= 0) {
    events[existing] = event
  } else {
    events.unshift(event)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, 50)))
}

const PROFILE_KEY = 'dale-schedule-profile'

export interface UserProfile {
  name: string
  email: string
}

export function getUserProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const data = localStorage.getItem(PROFILE_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export function saveUserProfile(profile: UserProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}
