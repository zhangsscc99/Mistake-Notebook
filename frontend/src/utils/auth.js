const TOKEN_KEY = 'mn_token'
const PROFILE_KEY = 'mn_profile'

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}

export function getProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null') } catch { return null }
}

export function setSession(token, profile) {
  localStorage.setItem(TOKEN_KEY, token || '')
  if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(PROFILE_KEY)
}

export function isLoggedIn() {
  return !!getToken()
}
