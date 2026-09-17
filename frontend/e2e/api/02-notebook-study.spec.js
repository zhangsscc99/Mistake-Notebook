const { test, expect } = require('@playwright/test')
const { call, expectOk, data, register, createQuestion } = require('../helpers')

test.describe('Notebook, categories, study tools, papers', () => {
  test('categories, CRUD questions, marks, notes, practice, papers', async ({ request }) => {
    const user = await register(request, { nickName: '错题同学' })

    const cats = await call(request, { path: '/categories', token: user.token })
    expectOk(cats, 'categories')
    const list = data(cats)
    expect(list.length).toBeGreaterThanOrEqual(8)
    expect(list.some(c => c.name === '数学')).toBeTruthy()
    expect(list.every(c => typeof c.icon === 'string' && c.icon.length <= 2)).toBeTruthy()

    const stats = await call(request, { path: '/categories/stats', token: user.token })
    expectOk(stats, 'cat stats')

    const q = await createQuestion(request, user.token)
    expect(q.id).toBeTruthy()
    expect(q.content).toContain('x+3')

    const got = await call(request, { path: `/questions/${q.id}`, token: user.token })
    expectOk(got, 'get question')

    const listed = await call(request, { path: '/questions?category=数学', token: user.token })
    expectOk(listed, 'list questions')
    expect(data(listed).some(row => row.id === q.id)).toBeTruthy()

    const pending = await call(request, { path: '/questions/pending', token: user.token })
    expectOk(pending, 'pending')

    const updated = await call(request, {
      method: 'PUT',
      path: `/questions/${q.id}`,
      token: user.token,
      data: { content: '已知 x+3=8，求 x。（订正）', category: '数学', difficulty: 'medium' }
    })
    expectOk(updated, 'update question')

    const mark = await call(request, {
      method: 'POST',
      path: '/study/marks',
      token: user.token,
      data: { questionId: q.id, favorite: true, pinned: true, mastered: false }
    })
    expectOk(mark, 'mark')
    expect(data(mark).favorite).toBeTruthy()
    expect(data(mark).pinned).toBeTruthy()

    const marks = await call(request, {
      method: 'POST',
      path: '/study/marks/list',
      token: user.token,
      data: { questionIds: [q.id] }
    })
    expectOk(marks, 'marks list')

    const note = await call(request, {
      method: 'POST',
      path: '/study/notes',
      token: user.token,
      data: { questionId: q.id, content: '移项时容易把符号弄反' }
    })
    expectOk(note, 'note')

    const notes = await call(request, {
      method: 'POST',
      path: '/study/notes/list',
      token: user.token,
      data: { questionIds: [q.id] }
    })
    expectOk(notes, 'notes list')
    expect(data(notes)[0].content).toContain('符号')

    const practice = await call(request, { path: '/study/practice', token: user.token })
    expectOk(practice, 'practice')
    expect(data(practice).some(row => row.id === q.id)).toBeTruthy()

    const overview = await call(request, { path: '/study/overview', token: user.token })
    expectOk(overview, 'overview')

    const byCat = await call(request, { path: `/questions/by-category/${list.find(c => c.name === '数学').id}`, token: user.token })
    expectOk(byCat, 'by-category')

    const batch = await call(request, { method: 'POST', path: '/questions/batch', token: user.token, data: [q.id] })
    expectOk(batch, 'batch')

    const catStat = await call(request, { path: '/questions/statistics/category', token: user.token })
    expectOk(catStat, 'q cat stats')
    const diffStat = await call(request, { path: '/questions/statistics/difficulty', token: user.token })
    expectOk(diffStat, 'q diff stats')

    const savedPaper = await call(request, {
      method: 'POST',
      path: '/test-paper/saved',
      token: user.token,
      data: {
        title: 'E2E 练习卷',
        duration: 45,
        totalScore: 5,
        questions: [{ id: q.id, content: q.content, answer: 'x=5' }]
      }
    })
    expectOk(savedPaper, 'save paper')
    const paperId = data(savedPaper).id

    const papers = await call(request, { path: '/test-paper/saved', token: user.token })
    expectOk(papers, 'list papers')
    expect(data(papers).some(p => p.id === paperId)).toBeTruthy()

    const pdf = await call(request, {
      method: 'POST',
      path: '/test-paper/generate',
      token: user.token,
      data: { title: 'E2E PDF', duration: '45', totalScore: '5', questionIds: [q.id] },
      timeout: 60_000
    })
    expect(pdf.status).toBe(200)
    expect(pdf.ct).toContain('pdf')
    expect(Buffer.isBuffer(pdf.body) ? pdf.body.length : 0).toBeGreaterThan(100)

    const delPaper = await call(request, { method: 'DELETE', path: `/test-paper/saved/${paperId}`, token: user.token })
    expectOk(delPaper, 'delete paper')

    const delQ = await call(request, { method: 'DELETE', path: `/questions/${q.id}`, token: user.token })
    expectOk(delQ, 'delete question')
  })

  test('item-6 gates: one question is enough; empty selection is rejected', async ({ request }) => {
    test.setTimeout(180_000)
    const user = await register(request, { nickName: '门槛同学' })

    const emptyReport = await call(request, {
      method: 'POST',
      path: '/study/learning-reports',
      token: user.token
    })
    expect(emptyReport.status).toBe(400)
    expect(String(emptyReport.body.message)).toMatch(/1 道|一道|至少/)

    const emptyMistake = await call(request, {
      method: 'POST',
      path: '/study/mistake-reports',
      token: user.token,
      data: { questionIds: [] }
    })
    expect(emptyMistake.status).toBe(400)

    const emptyVariants = await call(request, {
      method: 'POST',
      path: '/study/variants',
      token: user.token,
      data: { questionIds: [] }
    })
    expect(emptyVariants.status).toBe(400)

    const q = await createQuestion(request, user.token)

    const explain = await call(request, {
      method: 'POST',
      path: '/study/explain',
      token: user.token,
      data: { questionId: q.id },
      timeout: 120_000
    })
    expectOk(explain, 'explain')
    expect(String(data(explain).content || '')).toBeTruthy()

    const learning = await call(request, {
      method: 'POST',
      path: '/study/learning-reports',
      token: user.token,
      timeout: 120_000
    })
    expectOk(learning, 'learning report')
    expect(data(learning).id).toBeTruthy()
    expect(data(learning).questionCount).toBeGreaterThanOrEqual(1)

    const listedLearn = await call(request, { path: '/study/learning-reports', token: user.token })
    expectOk(listedLearn, 'list learning')
    const learnId = data(learning).id
    const oneLearn = await call(request, { path: `/study/learning-reports/${learnId}`, token: user.token })
    expectOk(oneLearn, 'get learning')

    const mistake = await call(request, {
      method: 'POST',
      path: '/study/mistake-reports',
      token: user.token,
      data: { questionId: q.id },
      timeout: 120_000
    })
    expectOk(mistake, 'mistake report')
    expect(data(mistake).questionCount).toBe(1)
    const mistakeId = data(mistake).id
    const listedMistake = await call(request, { path: '/study/mistake-reports', token: user.token })
    expectOk(listedMistake, 'list mistake')
    const oneMistake = await call(request, { path: `/study/mistake-reports/${mistakeId}`, token: user.token })
    expectOk(oneMistake, 'get mistake')

    const variants = await call(request, {
      method: 'POST',
      path: '/study/variants',
      token: user.token,
      data: { questionIds: [q.id] },
      timeout: 120_000
    })
    if (variants.status === 400 && String(variants.body.message || '').includes('未能生成')) {
      expect(variants.body.success).toBeFalsy()
    } else {
      expectOk(variants, 'variants')
      expect(data(variants).length).toBeGreaterThan(0)
    }

    const delLearn = await call(request, { method: 'DELETE', path: `/study/learning-reports/${learnId}`, token: user.token })
    expectOk(delLearn, 'delete learning')
    const delMistake = await call(request, { method: 'DELETE', path: `/study/mistake-reports/${mistakeId}`, token: user.token })
    expectOk(delMistake, 'delete mistake')
  })

  test('chat assistant returns a reply', async ({ request }) => {
    test.setTimeout(150_000)
    const user = await register(request)
    const chat = await call(request, {
      method: 'POST',
      path: '/answer/chat',
      token: user.token,
      data: { messages: [{ role: 'user', content: '1+1 等于几？只回答数字。' }] },
      timeout: 120_000
    })
    expectOk(chat, 'chat')
    expect(String(data(chat).reply || '')).toBeTruthy()
  })

  test('retry-ai requeues a question instead of leaving it stuck', async ({ request }) => {
    const user = await register(request)
    const q = await createQuestion(request, user.token, { content: '重试题：3+5=?', aiAnswer: '8' })
    const retry = await call(request, {
      method: 'POST',
      path: `/questions/${q.id}/retry-ai`,
      token: user.token,
      timeout: 30_000
    })
    expectOk(retry, 'retry-ai')
    const row = data(retry)
    const status = String(row.aiStatus || '').toLowerCase()
    expect(['pending', 'processing', 'completed', 'failed']).toContain(status)
    if (status === 'pending' || status === 'processing') {
      expect(row.aiError == null || row.aiError === '').toBeTruthy()
      const pending = await call(request, { path: '/questions/pending', token: user.token })
      expectOk(pending, 'pending after retry')
      const mine = data(pending).find((item) => item.id === q.id)
      expect(mine).toBeTruthy()
    }
  })
})
