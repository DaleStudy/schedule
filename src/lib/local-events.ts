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
