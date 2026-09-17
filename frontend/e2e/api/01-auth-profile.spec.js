const { test, expect } = require('@playwright/test')
const { call, expectOk, data, register, login, uid } = require('../helpers')

test.describe('Auth, profile, wallet', () => {
  test('rejects public access and weak register inputs', async ({ request }) => {
    const noAuth = await call(request, { path: '/user/me' })
    expect(noAuth.status).toBe(401)

    const short = await call(request, {
      method: 'POST',
      path: '/auth/register',
      data: { username: 'a', password: '12', nickName: 'x' }
    })
    expect(short.status).toBe(400)
    expect(short.body.success).toBeFalsy()

    const badLogin = await call(request, {
      method: 'POST',
      path: '/auth/login',
      data: { username: uid('gone'), password: 'pass1234' }
    })
    expect(badLogin.status).toBe(400)
  })

  test('register, login, edit profile, change password', async ({ request }) => {
    const user = await register(request, { nickName: '端到端同学' })
    expect(user.token).toBeTruthy()
    expect(user.profile.role).toBe('STUDENT')

    const me = await call(request, { path: '/user/me', token: user.token })
    expectOk(me, 'me')
    expect(data(me).username).toBe(user.username)

    const dup = await call(request, {
      method: 'POST',
      path: '/auth/register',
      data: { username: user.username, password: 'pass1234', nickName: '占用' }
    })
    expect(dup.status).toBe(400)

    const saved = await call(request, {
      method: 'POST',
      path: '/user/profile',
      token: user.token,
      data: { nickName: '改名同学', stage: '高中', school: 'E2E中学', className: '高一(1)', leaderboardPublic: true }
    })
    expectOk(saved, 'profile')
    expect(data(saved).nickName).toBe('改名同学')
    expect(data(saved).stage).toBe('高中')

    const pwd = await call(request, {
      method: 'POST',
      path: '/user/password',
      token: user.token,
      data: { oldPassword: 'pass1234', newPassword: 'pass5678' }
    })
    expectOk(pwd, 'password')
    const next = data(pwd).token
    expect(next).toBeTruthy()

    const again = await login(request, user.username, 'pass5678')
    expect(again.token).toBeTruthy()
  })

  test('check-in, plaza share, like, vip gate, stats, leaderboard', async ({ request }) => {
    const user = await register(request, { nickName: '打卡同学' })

    const wallet0 = await call(request, { path: '/user/wallet', token: user.token })
    expectOk(wallet0, 'wallet')
    expect(data(wallet0).todayChecked).toBeFalsy()

    const checkin = await call(request, { method: 'POST', path: '/user/checkin', token: user.token })
    expectOk(checkin, 'checkin')
    expect(data(checkin).todayChecked || data(checkin).rewarded).toBeTruthy()

    const twice = await call(request, { method: 'POST', path: '/user/checkin', token: user.token })
    expect(twice.status).toBe(400)

    const share = await call(request, {
      method: 'POST',
      path: '/user/checkin/share',
      token: user.token,
      data: { content: 'E2E 今日已打卡' }
    })
    expectOk(share, 'plaza share')

    const feed = await call(request, { path: '/user/checkin/feed', token: user.token })
    expectOk(feed, 'feed')
    const posts = data(feed)
    expect(Array.isArray(posts)).toBeTruthy()
    const mine = posts.find(p => p.content && String(p.content).includes('E2E'))
    expect(mine).toBeTruthy()

    const liked = await call(request, {
      method: 'POST',
      path: '/user/checkin/like',
      token: user.token,
      data: { postId: mine.id }
    })
    expectOk(liked, 'like plaza')

    const vip = await call(request, { method: 'POST', path: '/user/vip', token: user.token })
    expect(vip.status).toBe(400)
    expect(String(vip.body.message)).toContain('金币')

    const stats = await call(request, { path: '/user/stats', token: user.token })
    expectOk(stats, 'stats')
    expect(data(stats).checkinTotalDays).toBeGreaterThanOrEqual(1)

    const board = await call(request, { path: '/user/leaderboard', token: user.token })
    expectOk(board, 'leaderboard')
    expect(Array.isArray(data(board))).toBeTruthy()
  })

  test('quota and chat memory endpoints exist', async ({ request }) => {
    const user = await register(request)
    const quota = await call(request, { path: '/answer/quota', token: user.token })
    expectOk(quota, 'quota')
    expect(data(quota)).toHaveProperty('allowed')

    const mem = await call(request, { path: '/answer/memory-status', token: user.token })
    expectOk(mem, 'memory')
    expect(data(mem)).toHaveProperty('hasMemory')

    const sum = await call(request, {
      method: 'POST',
      path: '/answer/summarize',
      token: user.token,
      data: { messages: [{ role: 'user', content: '二次函数怎么求顶点' }], questionContext: '' }
    })
    expectOk(sum, 'summarize')
  })
})
