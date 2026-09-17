const { request } = require('@playwright/test')

const API = process.env.E2E_API || 'http://127.0.0.1:8080/api'
const FRONTEND = process.env.E2E_BASE_URL || 'http://127.0.0.1:3060'

module.exports = async function globalSetup() {
  const ctx = await request.newContext({ timeout: 15_000 })
  try {
    const api = await ctx.post(`${API}/auth/login`, {
      data: { username: '__health__', password: 'xxxx' },
      failOnStatusCode: false
    })
    if (api.status() === 0) {
      throw new Error(`Backend is not reachable at ${API}. Start Spring Boot on 8080 first.`)
    }
    const front = await ctx.get(FRONTEND, { failOnStatusCode: false })
    if (front.status() === 0) {
      throw new Error(`Frontend is not reachable at ${FRONTEND}. Start npm run serve on 3060 first.`)
    }
  } finally {
    await ctx.dispose()
  }
}
