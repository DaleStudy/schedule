const PROFILE_KEY = 'dale-schedule-profile'
const ADMIN_TOKENS_KEY = 'dale-schedule-admin-tokens'

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

export function saveAdminToken(eventId: string, adminToken: string) {
  if (typeof window === 'undefined') return
  try {
    const data = localStorage.getItem(ADMIN_TOKENS_KEY)
    const tokens: Record<string, string> = data ? JSON.parse(data) : {}
    tokens[eventId] = adminToken
    localStorage.setItem(ADMIN_TOKENS_KEY, JSON.stringify(tokens))
  } catch {}
}

export function getAdminToken(eventId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const data = localStorage.getItem(ADMIN_TOKENS_KEY)
    if (!data) return null
    const tokens: Record<string, string> = JSON.parse(data)
    return tokens[eventId] || null
  } catch {
    return null
  }
}
