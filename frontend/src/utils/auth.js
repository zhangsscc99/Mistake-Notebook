const TOKEN_KEY = 'mn_token'
const PROFILE_KEY = 'mn_profile'
const LAST_ROLE_KEY = 'mn_last_role'

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}

export function getProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null') } catch { return null }
}

export function getLastRole() {
  try {
    const stored = localStorage.getItem(LAST_ROLE_KEY)
    if (stored === 'TEACHER' || stored === 'STUDENT') return stored
  } catch { /* ignore */ }
  const profile = getProfile()
  return profile && profile.role === 'TEACHER' ? 'TEACHER' : 'STUDENT'
}

export function setSession(token, profile) {
  localStorage.setItem(TOKEN_KEY, token || '')
  if (profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
    if (profile.role === 'TEACHER' || profile.role === 'STUDENT') {
      localStorage.setItem(LAST_ROLE_KEY, profile.role)
    }
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(PROFILE_KEY)
}

export function isLoggedIn() {
  return !!getToken()
}

export function getRole() {
  return getProfile()?.role === 'TEACHER' ? 'TEACHER' : 'STUDENT'
}

export function isTeacher() {
  return getRole() === 'TEACHER'
}
