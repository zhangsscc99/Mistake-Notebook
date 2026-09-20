const { test, expect } = require('@playwright/test')
const { call, expectOk, data, register, createQuestion, TINY_PNG, uid } = require('../helpers')

test.describe('Teacher workspace + student classroom', () => {
  test('class join approval, bank, papers, homework, notebooks, reports, org tenant', async ({ request }) => {
    test.setTimeout(180_000)
    const teacher = await register(request, { role: 'TEACHER', nickName: 'E2E老师' })
    const student = await register(request, { nickName: 'E2E学生甲' })
    const studentB = await register(request, { nickName: 'E2E学生乙' })

    const dash = await call(request, { path: '/teacher/dashboard', token: teacher.token })
    expectOk(dash, 'dashboard')

    const created = await call(request, {
      method: 'POST',
      path: '/teacher/classes',
      token: teacher.token,
      data: { name: 'E2E高一(1)班', grade: '高一' }
    })
    expectOk(created, 'create class')
    const cls = data(created)
    expect(cls.joinCode).toBeTruthy()
    const classId = cls.id

    const classes = await call(request, { path: '/teacher/classes', token: teacher.token })
    expectOk(classes, 'list classes')
    expect(data(classes).some(c => c.id === classId)).toBeTruthy()

    const join = await call(request, {
      method: 'POST',
      path: '/classroom/join',
      token: student.token,
      data: { code: cls.joinCode }
    })
    expectOk(join, 'join')
    expect(data(join).pending).toBeTruthy()

    const pendingJoin = await call(request, {
      method: 'POST',
      path: '/classroom/join',
      token: student.token,
      data: { code: cls.joinCode }
    })
    expectOk(pendingJoin, 'join again')
    expect(data(pendingJoin).pending).toBeTruthy()

    const reqs = await call(request, { path: `/teacher/classes/${classId}/join-requests`, token: teacher.token })
    expectOk(reqs, 'join requests')
    expect(data(reqs).some(r => r.id === student.id)).toBeTruthy()

    const approved = await call(request, {
      method: 'POST',
      path: `/teacher/classes/${classId}/approve`,
      token: teacher.token,
      data: { studentId: student.id }
    })
    expectOk(approved, 'approve')

    const joinB = await call(request, {
      method: 'POST',
      path: '/classroom/teachers',
      token: studentB.token,
      data: { joinCode: cls.joinCode }
    })
    expectOk(joinB, 'join B')
    const rejected = await call(request, {
      method: 'POST',
      path: `/teacher/classes/${classId}/reject`,
      token: teacher.token,
      data: { studentId: studentB.id }
    })
    expectOk(rejected, 'reject')

    const roster = await call(request, { path: `/teacher/classes/${classId}/students`, token: teacher.token })
    expectOk(roster, 'roster')
    expect(data(roster).some(s => s.id === student.id)).toBeTruthy()
    expect(data(roster).some(s => s.id === studentB.id)).toBeFalsy()

    const q = await createQuestion(request, student.token, { content: '班级错题：求 2x=10 的 x。', aiAnswer: 'x=5' })

    const inspect = await call(request, {
      path: `/teacher/classes/${classId}/students/${student.id}`,
      token: teacher.token
    })
    expectOk(inspect, 'student overview')
    const sq = await call(request, {
      path: `/teacher/classes/${classId}/students/${student.id}/questions`,
      token: teacher.token
    })
    expectOk(sq, 'student questions')

    const remark = await call(request, {
      method: 'POST',
      path: `/teacher/students/${student.id}/remark`,
      token: teacher.token,
      data: { remark: '需要盯计算' }
    })
    expectOk(remark, 'remark')

    const msg = await call(request, {
      method: 'POST',
      path: `/teacher/students/${student.id}/messages`,
      token: teacher.token,
      data: { content: '今晚把方程订正再交一次。' }
    })
    expectOk(msg, 'teacher message')
    const reply = await call(request, {
      method: 'POST',
      path: `/classroom/teachers/${teacher.id}/messages`,
      token: student.token,
      data: { content: '收到，老师。' }
    })
    expectOk(reply, 'student message')
    const thread = await call(request, {
      path: `/classroom/teachers/${teacher.id}/messages`,
      token: student.token
    })
    expectOk(thread, 'messages')
    expect(data(thread).length).toBeGreaterThanOrEqual(2)

    const bank = await call(request, {
      method: 'POST',
      path: '/teacher/bank',
      token: teacher.token,
      data: {
        classId,
        category: '数学',
        difficulty: 'easy',
        questions: [{ content: '题库题：3x=12，求 x。', text: '题库题：3x=12，求 x。' }]
      }
    })
    expectOk(bank, 'bank')
    const bankId = data(bank).ids[0]
    const bankList = await call(request, { path: `/teacher/bank?classId=${classId}`, token: teacher.token })
    expectOk(bankList, 'list bank')

    const picked = await call(request, {
      method: 'POST',
      path: '/teacher/picked',
      token: teacher.token,
      data: { questionIds: [bankId, q.id] }
    })
    expectOk(picked, 'picked')

    const paper = await call(request, {
      method: 'POST',
      path: '/teacher/papers',
      token: teacher.token,
      data: { classId, title: 'E2E 题单', questionIds: [bankId], duration: 40 }
    })
    expectOk(paper, 'save paper')
    const paperId = data(paper).id
    const paperDetail = await call(request, { path: `/teacher/papers/${paperId}`, token: teacher.token })
    expectOk(paperDetail, 'paper detail')
    const papers = await call(request, { path: `/teacher/papers?classId=${classId}`, token: teacher.token })
    expectOk(papers, 'list papers')

    const homework = await call(request, {
      method: 'POST',
      path: '/teacher/homework',
      token: teacher.token,
      data: { classId, title: 'E2E 作业', questionIds: [bankId], description: '独立完成', dueAt: '2099-12-31T23:59:00' }
    })
    expectOk(homework, 'homework')
    const hwId = data(homework).id

    const studentHw = await call(request, { path: '/classroom/homework', token: student.token })
    expectOk(studentHw, 'student homework list')
    expect(data(studentHw).some(h => h.id === hwId)).toBeTruthy()

    const hwDetail = await call(request, { path: `/classroom/homework/${hwId}`, token: student.token })
    expectOk(hwDetail, 'student hw detail')

    const submit = await call(request, {
      method: 'POST',
      path: `/classroom/homework/${hwId}/submit`,
      token: student.token,
      data: { answers: ['x=4'] }
    })
    expectOk(submit, 'submit hw')

    const teacherHw = await call(request, { path: `/teacher/homework/${hwId}`, token: teacher.token })
    expectOk(teacherHw, 'teacher hw detail')
    const submissionId = data(teacherHw).roster.find(r => r.studentId === student.id).submissionId
    expect(submissionId).toBeTruthy()

    const graded = await call(request, {
      method: 'POST',
      path: `/teacher/submissions/${submissionId}/grade`,
      token: teacher.token,
      data: { marks: ['right'], comment: '计算正确' }
    })
    expectOk(graded, 'grade')
    expect(data(graded).score).toBe(100)

    const practice = await call(request, {
      method: 'POST',
      path: '/teacher/notebooks/publish',
      token: teacher.token,
      data: { classId, title: 'E2E 练习册', questionIds: [bankId] }
    })
    expectOk(practice, 'publish notebook')
    const nbId = data(practice).id
    const nbs = await call(request, { path: `/teacher/class-notebooks?classId=${classId}`, token: teacher.token })
    expectOk(nbs, 'list class notebooks')
    const nbDetail = await call(request, { path: `/teacher/class-notebooks/${nbId}`, token: teacher.token })
    expectOk(nbDetail, 'nb detail')

    const studentNbs = await call(request, { path: '/classroom/notebooks', token: student.token })
    expectOk(studentNbs, 'student notebooks')
    const sn = await call(request, { path: `/classroom/notebooks/${nbId}`, token: student.token })
    expectOk(sn, 'student nb detail')
    const progress = await call(request, {
      method: 'POST',
      path: `/classroom/notebooks/${nbId}/progress`,
      token: student.token,
      data: { doneCount: 1, masteredCount: 1 }
    })
    expectOk(progress, 'progress')

    const classQs = await call(request, { path: `/teacher/class-questions?classId=${classId}`, token: teacher.token })
    expectOk(classQs, 'class questions')
    const classStats = await call(request, { path: `/teacher/class-stats?classId=${classId}`, token: teacher.token })
    expectOk(classStats, 'class stats')
    const analytics = await call(request, { path: '/teacher/analytics', token: teacher.token })
    expectOk(analytics, 'analytics')
    const freq = await call(request, { path: '/teacher/high-frequency', token: teacher.token })
    expectOk(freq, 'high frequency')

    const classReport = await call(request, {
      method: 'POST',
      path: '/teacher/class-reports',
      token: teacher.token,
      data: { classId }
    })
    expectOk(classReport, 'class parent report')
    const reportId = data(classReport).id
    const reports = await call(request, { path: `/teacher/class-reports?classId=${classId}`, token: teacher.token })
    expectOk(reports, 'list class reports')
    const reportDetail = await call(request, { path: `/teacher/class-reports/${reportId}`, token: teacher.token })
    expectOk(reportDetail, 'class report detail')

    const parent = await call(request, {
      method: 'POST',
      path: `/teacher/students/${student.id}/parent-reports`,
      token: teacher.token,
      data: { note: '计算已进步' },
      timeout: 120_000
    })
    expectOk(parent, 'student parent report')
    const parentId = data(parent).id
    const parentList = await call(request, { path: `/teacher/students/${student.id}/parent-reports`, token: teacher.token })
    expectOk(parentList, 'list parent')
    const parentGet = await call(request, { path: `/teacher/parent-reports/${parentId}`, token: teacher.token })
    expectOk(parentGet, 'get parent')
    const studentParents = await call(request, { path: '/classroom/parent-reports', token: student.token })
    expectOk(studentParents, 'student parent list')
    const studentParent = await call(request, { path: `/classroom/parent-reports/${parentId}`, token: student.token })
    expectOk(studentParent, 'student parent detail')

    const summary = await call(request, { path: '/classroom/summary', token: student.token })
    expectOk(summary, 'classroom summary')
    const myClasses = await call(request, { path: '/classroom/classes', token: student.token })
    expectOk(myClasses, 'my classes')
    const myTeachers = await call(request, { path: '/classroom/teachers', token: student.token })
    expectOk(myTeachers, 'my teachers')

    const upload = await call(request, {
      method: 'POST',
      path: '/upload/file',
      token: teacher.token,
      multipart: {
        file: { name: 'logo.png', mimeType: 'image/png', buffer: TINY_PNG }
      }
    })
    expectOk(upload, 'upload logo')
    const logoUrl = data(upload).url
    expect(logoUrl).toContain('/uploads/')

    const slug = uid('org').toLowerCase()
    const org = await call(request, {
      method: 'PUT',
      path: '/orgs/mine',
      token: teacher.token,
      data: {
        name: 'E2E 智卷工作室',
        slug,
        city: '香港',
        tagline: '端到端真实租户',
        headline: '班级题库和作业都在线上',
        pitch: '老师上传 Logo，公开页带真实班级。',
        logoUrl,
        primary: '#2459ff',
        accent: '#52b7ff',
        quote: '把错题本做成班级工作台。',
        quoteBy: 'E2E老师',
        published: true
      }
    })
    expectOk(org, 'save org')
    expect(data(org).exists).toBeTruthy()
    const reserved = await call(request, {
      method: 'PUT',
      path: '/orgs/mine',
      token: teacher.token,
      data: { name: '占用演示名', slug: 'qiming' }
    })
    expect(reserved.status).toBe(400)

    const mine = await call(request, { path: '/orgs/mine', token: teacher.token })
    expectOk(mine, 'org mine')
    const publicOrg = await call(request, { path: `/orgs/${slug}` })
    expectOk(publicOrg, 'public org')
    expect(data(publicOrg).demo).toBeFalsy()

    const recallHw = await call(request, { method: 'POST', path: `/teacher/homework/${hwId}/recall`, token: teacher.token })
    expectOk(recallHw, 'recall homework')
    const recallNb = await call(request, { method: 'POST', path: `/teacher/notebooks/${nbId}/recall`, token: teacher.token })
    expectOk(recallNb, 'recall notebook')
    const recallPaper = await call(request, { method: 'POST', path: `/teacher/papers/${paperId}/recall`, token: teacher.token })
    expectOk(recallPaper, 'recall paper')
    const delBank = await call(request, { method: 'DELETE', path: `/teacher/bank/${bankId}`, token: teacher.token })
    expectOk(delBank, 'delete bank')
    const delParent = await call(request, { method: 'DELETE', path: `/teacher/parent-reports/${parentId}`, token: teacher.token })
    expectOk(delParent, 'delete parent report')
  })

  test('legacy bind-by-username and class notebook push still work', async ({ request }) => {
    const teacher = await register(request, { role: 'TEACHER', nickName: '旧接口老师' })
    const student = await register(request, { nickName: '旧接口学生' })
    const bind = await call(request, {
      method: 'POST',
      path: '/teacher/students',
      token: teacher.token,
      data: { username: student.username, remark: '直绑' }
    })
    expectOk(bind, 'bind username')
    const students = await call(request, { path: '/teacher/students', token: teacher.token })
    expectOk(students, 'legacy students')
    const overview = await call(request, { path: `/teacher/students/${student.id}`, token: teacher.token })
    expectOk(overview, 'legacy overview')

    const nb = await call(request, {
      method: 'POST',
      path: '/teacher/notebooks',
      token: teacher.token,
      data: { title: '旧错题本', questions: [{ content: '1+1=?', answer: '2', category: '数学' }] }
    })
    expectOk(nb, 'legacy notebook')
    const nbId = data(nb).id
    const pushed = await call(request, { method: 'POST', path: `/teacher/notebooks/${nbId}/push`, token: teacher.token })
    expectOk(pushed, 'push notebook')
    const listed = await call(request, { path: '/teacher/notebooks', token: teacher.token })
    expectOk(listed, 'list notebooks')
    const detail = await call(request, { path: `/teacher/notebooks/${nbId}`, token: teacher.token })
    expectOk(detail, 'notebook detail')
  })

  test('student cannot open teacher APIs', async ({ request }) => {
    const student = await register(request)
    const dash = await call(request, { path: '/teacher/dashboard', token: student.token })
    expect(dash.status).toBe(400)
  })
})
