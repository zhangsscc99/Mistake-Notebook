const API = process.env.E2E_API || 'http://127.0.0.1:8080/api'

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

function uid(prefix = 'e2e') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 32)
}

async function call(request, { method = 'GET', path, token, data, multipart, timeout } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const opts = { method, headers, failOnStatusCode: false, timeout: timeout || 30_000 }
  if (multipart) {
    opts.multipart = multipart
  } else if (data !== undefined) {
    headers['Content-Type'] = 'application/json'
    opts.data = data
  }
  const res = await request.fetch(`${API}${path}`, opts)
  const ct = String(res.headers()['content-type'] || '')
  let body = null
  if (ct.includes('application/json')) {
    body = await res.json()
  } else if (ct.includes('application/pdf') || ct.includes('octet-stream') || ct.includes('image/')) {
    body = await res.body()
  } else {
    const text = await res.text()
    try { body = JSON.parse(text) } catch { body = text }
  }
  return { status: res.status(), ok: res.ok(), headers: res.headers(), body, ct }
}

function expectOk(res, label = 'request') {
  const success = res.body && typeof res.body === 'object' && !Buffer.isBuffer(res.body)
    ? res.body.success !== false
    : res.ok
  if (!res.ok || success === false) {
    const detail = Buffer.isBuffer(res.body) ? `<binary ${res.body.length}b>` : JSON.stringify(res.body)
    throw new Error(`${label} failed: HTTP ${res.status} ${detail}`)
  }
}

function data(res) {
  return res.body && res.body.data !== undefined ? res.body.data : res.body
}

async function register(request, { role = 'STUDENT', nickName } = {}) {
  const username = uid(role === 'TEACHER' ? 't' : 's')
  const password = 'pass1234'
  const res = await call(request, {
    method: 'POST',
    path: '/auth/register',
    data: { username, password, nickName: nickName || username, role }
  })
  expectOk(res, `register ${username}`)
  const payload = data(res)
  return {
    username,
    password,
    token: payload.token,
    profile: payload,
    id: payload.id
  }
}

async function login(request, username, password) {
  const res = await call(request, {
    method: 'POST',
    path: '/auth/login',
    data: { username, password }
  })
  expectOk(res, `login ${username}`)
  const payload = data(res)
  return { token: payload.token, profile: payload, id: payload.id }
}

async function createQuestion(request, token, extra = {}) {
  const res = await call(request, {
    method: 'POST',
    path: '/questions',
    token,
    data: {
      content: extra.content || '已知 x+3=8，求 x。',
      category: extra.category || '数学',
      difficulty: extra.difficulty || 'easy',
      aiAnswer: extra.aiAnswer || 'x=5',
      aiAnalysis: extra.aiAnalysis || '两边同时减 3 得到 x=5。',
      aiStatus: 'COMPLETED',
      tags: extra.tags || ['e2e'],
      ...extra
    }
  })
  expectOk(res, 'create question')
  return data(res)
}

async function injectSession(page, token, profile) {
  await page.addInitScript(({ token, profile }) => {
    localStorage.setItem('mn_token', token)
    localStorage.setItem('mn_profile', JSON.stringify(profile))
  }, { token, profile })
}

module.exports = {
  API,
  TINY_PNG,
  uid,
  call,
  expectOk,
  data,
  register,
  login,
  createQuestion,
  injectSession
}
