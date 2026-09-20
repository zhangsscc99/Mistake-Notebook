const { test, expect } = require('@playwright/test')
const { call, expectOk, data, register, createQuestion } = require('../helpers')

test.describe('Org showcase + community social', () => {
  test('public org directory includes demo cases', async ({ request }) => {
    const listed = await call(request, { path: '/orgs' })
    expectOk(listed, 'org list')
    const rows = data(listed)
    const slugs = rows.map(o => o.slug)
    expect(slugs).toEqual(expect.arrayContaining(['qiming', 'qingteng', 'xinghe']))

    const demo = await call(request, { path: '/orgs/qiming' })
    expectOk(demo, 'qiming')
    expect(data(demo).demo).toBeTruthy()
    expect(data(demo).name).toBeTruthy()

    const mine = await call(request, { path: '/orgs/mine' })
    expect(mine.status).toBe(401)

    const student = await register(request)
    const studentMine = await call(request, { path: '/orgs/mine', token: student.token })
    expect(studentMine.status).toBe(400)
  })

  test('teacher publishes org and student joins by code', async ({ request }) => {
    const teacher = await register(request, { role: 'TEACHER', nickName: '机构老师' })
    const student = await register(request, { nickName: '机构学生' })
    const slug = ('org' + Date.now().toString(36)).toLowerCase()
    const saved = await call(request, {
      method: 'PUT',
      path: '/orgs/mine',
      token: teacher.token,
      data: { name: '加入码学堂', slug, city: '上海', published: false }
    })
    expectOk(saved, 'save unpublished')
    expect(data(saved).joinCode).toBeTruthy()
    const hidden = await call(request, { path: `/orgs/${slug}` })
    expect(hidden.status).toBe(400)

    const published = await call(request, {
      method: 'PUT',
      path: '/orgs/mine',
      token: teacher.token,
      data: { name: '加入码学堂', slug, city: '上海', published: true }
    })
    expectOk(published, 'publish')
    const joinCode = data(published).joinCode

    const apply = await call(request, {
      method: 'POST',
      path: '/orgs/join',
      token: student.token,
      data: { code: joinCode }
    })
    expectOk(apply, 'student apply')
    expect(data(apply).pending).toBeTruthy()

    const mine = await call(request, { path: '/orgs/mine', token: teacher.token })
    expectOk(mine, 'teacher mine')
    expect(data(mine).pending.some((s) => s.id === student.id)).toBeTruthy()

    const ok = await call(request, {
      method: 'POST',
      path: `/orgs/mine/requests/${student.id}/approve`,
      token: teacher.token
    })
    expectOk(ok, 'approve')

    const joined = await call(request, { path: '/orgs/joined', token: student.token })
    expectOk(joined, 'joined')
    expect(data(joined).some((o) => o.slug === slug && o.status === 'approved')).toBeTruthy()
  })

  test('help board: post, filter, like, reply, delete', async ({ request }) => {
    const a = await register(request, { nickName: '求助甲' })
    const b = await register(request, { nickName: '热心乙' })
    const q = await createQuestion(request, a.token)

    const home = await call(request, { path: '/social/home', token: a.token })
    expectOk(home, 'social home')
    expect(data(home)).toHaveProperty('helpCount')

    const post = await call(request, {
      method: 'POST',
      path: '/social/help',
      token: a.token,
      data: {
        title: '这道方程卡在移项',
        content: 'x+3=8 我减成了 x=11，哪一步错了？',
        subject: '数学',
        questionId: q.id
      }
    })
    expectOk(post, 'create help')
    const postId = data(post).id
    expect(data(post).questionId).toBe(q.id)

    const listed = await call(request, { path: '/social/help', token: b.token })
    expectOk(listed, 'list help')
    expect(data(listed).some(p => p.id === postId)).toBeTruthy()

    const filtered = await call(request, {
      path: `/social/help?${new URLSearchParams({ subject: '数学' })}`,
      token: b.token
    })
    expectOk(filtered, 'filter help')
    expect(data(filtered).every(p => !p.subject || p.subject === '数学' || p.id === postId)).toBeTruthy()

    const liked = await call(request, { method: 'POST', path: `/social/help/${postId}/like`, token: b.token })
    expectOk(liked, 'like')
    expect(data(liked).liked).toBeTruthy()
    const unliked = await call(request, { method: 'POST', path: `/social/help/${postId}/like`, token: b.token })
    expectOk(unliked, 'unlike')
    expect(data(unliked).liked).toBeFalsy()

    const reply = await call(request, {
      method: 'POST',
      path: `/social/help/${postId}/replies`,
      token: b.token,
      data: { content: '两边同时减 3，x=5。' }
    })
    expectOk(reply, 'reply')
    const replyId = data(reply).replies.find(r => r.mine).id

    const detail = await call(request, { path: `/social/help/${postId}`, token: a.token })
    expectOk(detail, 'help detail')
    expect(data(detail).replies.length).toBeGreaterThanOrEqual(1)

    const delReply = await call(request, {
      method: 'DELETE',
      path: `/social/help/${postId}/replies/${replyId}`,
      token: b.token
    })
    expectOk(delReply, 'delete reply')

    const delPost = await call(request, { method: 'DELETE', path: `/social/help/${postId}`, token: a.token })
    expectOk(delPost, 'delete post')
    const gone = await call(request, { path: `/social/help/${postId}`, token: a.token })
    expect(gone.status).toBe(400)
  })

  test('friends: request, reject, cancel, accept, unfriend', async ({ request }) => {
    const a = await register(request, { nickName: '好友甲' })
    const b = await register(request, { nickName: '好友乙' })
    const c = await register(request, { nickName: '好友丙' })

    const sent = await call(request, {
      method: 'POST',
      path: '/social/friends',
      token: a.token,
      data: { username: b.username }
    })
    expectOk(sent, 'add friend')
    const search = await call(request, { path: `/social/users?q=${encodeURIComponent(b.username)}`, token: a.token })
    expectOk(search, 'search users')
    expect(data(search).some(u => u.username === b.username)).toBeTruthy()

    const cancel = await call(request, { method: 'POST', path: `/social/friends/${b.id}/cancel`, token: a.token })
    expectOk(cancel, 'cancel')

    const again = await call(request, {
      method: 'POST',
      path: '/social/friends',
      token: a.token,
      data: { username: b.username }
    })
    expectOk(again, 'add again')
    const reject = await call(request, { method: 'POST', path: `/social/friends/${a.id}/reject`, token: b.token })
    expectOk(reject, 'reject')

    const third = await call(request, {
      method: 'POST',
      path: '/social/friends',
      token: a.token,
      data: { username: c.username }
    })
    expectOk(third, 'add c')
    const accept = await call(request, { method: 'POST', path: `/social/friends/${a.id}/accept`, token: c.token })
    expectOk(accept, 'accept')
    const friends = await call(request, { path: '/social/friends', token: a.token })
    expectOk(friends, 'friends home')
    expect(data(friends).friends.some(f => f.id === c.id)).toBeTruthy()

    const unfriend = await call(request, { method: 'DELETE', path: `/social/friends/${c.id}`, token: a.token })
    expectOk(unfriend, 'unfriend')
    const after = await call(request, { path: '/social/friends', token: a.token })
    expect(data(after).friends.some(f => f.id === c.id)).toBeFalsy()
  })

  test('quiz PK: challenge, accept, both submit, settle', async ({ request }) => {
    const a = await register(request, { nickName: 'PK甲' })
    const b = await register(request, { nickName: 'PK乙' })
    await createQuestion(request, a.token, { content: 'PK题A：1+1=?', aiAnswer: '2' })
    await createQuestion(request, b.token, { content: 'PK题B：2+2=?', aiAnswer: '4' })

    const add = await call(request, {
      method: 'POST',
      path: '/social/friends',
      token: a.token,
      data: { username: b.username }
    })
    expectOk(add, 'friend for pk')
    const acceptF = await call(request, { method: 'POST', path: `/social/friends/${a.id}/accept`, token: b.token })
    expectOk(acceptF, 'accept friend pk')

    const challenge = await call(request, {
      method: 'POST',
      path: '/social/pk',
      token: a.token,
      data: { friendId: b.id }
    })
    expectOk(challenge, 'challenge')
    const match = data(challenge).lastMatch
    expect(match.id).toBeTruthy()
    expect(match.mode).toBe('QUIZ')
    expect(match.status).toBe('PENDING')

    const accepted = await call(request, { method: 'POST', path: `/social/pk/${match.id}/accept`, token: b.token })
    expectOk(accepted, 'accept pk')
    expect(data(accepted).lastMatch.status).toBe('ACTIVE')

    const play = await call(request, { path: `/social/pk/${match.id}`, token: a.token })
    expectOk(play, 'pk detail')
    const questions = (data(play).play && data(play).play.questions) || []
    expect(questions.length).toBeGreaterThan(0)
    const answers = {}
    for (const q of questions) {
      answers[String(q.id)] = '2'
    }

    const submitA = await call(request, {
      method: 'POST',
      path: `/social/pk/${match.id}/submit`,
      token: a.token,
      data: { answers }
    })
    expectOk(submitA, 'submit a')
    const submitB = await call(request, {
      method: 'POST',
      path: `/social/pk/${match.id}/submit`,
      token: b.token,
      data: { answers }
    })
    expectOk(submitB, 'submit b')
    expect(data(submitB).status).toBe('DONE')
  })
})
