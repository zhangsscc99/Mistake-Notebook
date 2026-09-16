const cloud = require('wx-server-sdk');
const https = require('https');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL || 'qwen-plus';

function openId() {
  const c = cloud.getWXContext();
  return c.OPENID || c.FROM_OPENID || '';
}
function fail(error) {
  return { success: false, error };
}
async function teacherDoc(id) {
  const r = await db.collection('users').where({ _id: id }).limit(1).get();
  return (r.data || [])[0] || null;
}
async function requireTeacher() {
  const id = openId();
  if (!id) throw new Error('NOT_TEACHER');
  const user = await teacherDoc(id);
  if (!user || user.role !== 'teacher') throw new Error('NOT_TEACHER');
  return id;
}
function normalizeClass(c) {
  return {
    id: c._id,
    name: c.name,
    grade: c.grade || '',
    joinCode: c.joinCode,
    studentCount: c.studentCount || 0,
    createdAt: c.createdAt
  };
}
function mapQuestion(q) {
  return {
    id: q._id,
    content: q.content || '',
    category: q.category || '',
    difficulty: q.difficulty || 'MEDIUM',
    imageUrl: q.imageUrl || '',
    openid: q.openid || '',
    aiStatus: q.aiStatus || '',
    createdAt: q.createdAt || ''
  };
}
function contentKey(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

async function ownedClasses(teacherId) {
  const r = await db.collection('classes').where({ teacherId, isDeleted: false }).orderBy('createdAt', 'desc').get();
  return r.data || [];
}

async function assertOwnedClass(teacherId, classId) {
  if (!classId) throw new Error('请选择班级');
  const cls = (await db.collection('classes').doc(classId).get()).data;
  if (!cls || cls.teacherId !== teacherId || cls.isDeleted) throw new Error('无权访问该班级');
  return cls;
}

function memberStatus(m) {
  if (!m || m.isDeleted) return '';
  if (m.status === 'pending' || m.status === 'rejected' || m.status === 'approved') return m.status;
  return 'approved';
}

async function listClassMembers(classId) {
  const r = await db.collection('class_members').where({ classId, isDeleted: false }).get();
  return r.data || [];
}

async function approvedMembers(classId) {
  return (await listClassMembers(classId)).filter((m) => memberStatus(m) === 'approved');
}

async function pendingMembers(classId) {
  return (await listClassMembers(classId)).filter((m) => memberStatus(m) === 'pending');
}

async function classStudentIds(classId) {
  return Array.from(new Set((await approvedMembers(classId)).map((m) => m.studentId).filter(Boolean)));
}

async function approvedClassIds(studentId) {
  const r = await db.collection('class_members').where({ studentId, isDeleted: false }).get();
  return (r.data || []).filter((m) => memberStatus(m) === 'approved').map((m) => m.classId);
}

async function findMembership(classId, studentId) {
  const r = await db.collection('class_members').where({ classId, studentId }).limit(5).get();
  const rows = r.data || [];
  return rows.find((m) => !m.isDeleted) || rows[0] || null;
}

async function mapMemberUsers(members) {
  const ids = Array.from(new Set(members.map((m) => m.studentId).filter(Boolean)));
  if (!ids.length) return [];
  const users = await db.collection('users').where({ _id: _.in(ids) }).get();
  const userMap = {};
  (users.data || []).forEach((u) => { userMap[u._id] = u; });
  return members.map((m) => {
    const u = userMap[m.studentId] || {};
    return {
      id: m.studentId,
      nickName: u.nickName || '',
      avatarFileID: u.avatarFileID || '',
      requestedAt: m.requestedAt || m.createdAt || '',
      lastActiveAt: u.updatedAt || ''
    };
  });
}

async function questionsByOpenIds(ids, limit) {
  if (!ids.length) return [];
  const cap = Math.min(limit || 100, 200);
  const rows = [];
  for (let i = 0; i < ids.length && rows.length < cap; i += 20) {
    const part = ids.slice(i, i + 20);
    const r = await db.collection('questions')
      .where({ openid: _.in(part), isDeleted: false })
      .orderBy('createdAt', 'desc')
      .limit(cap - rows.length)
      .get();
    rows.push(...(r.data || []));
  }
  return rows;
}

async function questionsByIds(ids) {
  const list = (ids || []).filter(Boolean);
  if (!list.length) return [];
  const rows = [];
  for (let i = 0; i < list.length; i += 20) {
    const part = list.slice(i, i + 20);
    const r = await db.collection('questions').where({ _id: _.in(part) }).get();
    rows.push(...(r.data || []));
  }
  const map = {};
  rows.forEach((q) => { if (!q.isDeleted) map[q._id] = q; });
  return list.map((id) => map[id]).filter(Boolean).map(mapQuestion);
}

function callDashScope(messages, temperature) {
  return new Promise((resolve, reject) => {
    if (!DASHSCOPE_API_KEY) {
      reject(new Error('未配置 DASHSCOPE_API_KEY'));
      return;
    }
    const data = JSON.stringify({
      model: DASHSCOPE_MODEL,
      messages,
      stream: false,
      temperature: temperature == null ? 0.3 : temperature
    });
    const url = new URL(DASHSCOPE_URL);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('模型返回无法解析')); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

exports.main = async (event) => {
  try {
    const studentActions = {
      joinClass,
      myClasses,
      myNotebooks,
      myNotebookDetail,
      myAssignments,
      myAssignmentDetail,
      submitAssignment
    };
    if (studentActions[event.action]) {
      return await studentActions[event.action](event);
    }
    const teacherId = await requireTeacher();
    const teacherActions = {
      dashboard,
      createClass,
      students,
      studentQuestions,
      studentOverview,
      teacherQuestions,
      classStats,
      publishNotebook,
      savePaper,
      listPapers,
      listNotebooks,
      paperDetail,
      notebookDetail,
      createAssignment,
      teacherAssignments,
      assignmentSubmissions,
      assignmentDetail,
      gradeAssignment,
      parentReport,
      listParentReports,
      parentReportDetail,
      chat,
      joinRequests,
      approveJoin,
      rejectJoin
    };
    const fn = teacherActions[event.action];
    if (!fn) return fail(`Unknown action: ${event.action}`);
    return await fn(teacherId, event);
  } catch (e) {
    if (e.message === 'NOT_TEACHER') return fail('NOT_TEACHER');
    console.error(e);
    return fail(e.message || '教师工作台加载失败');
  }
};

async function dashboard(teacherId) {
  const raw = await ownedClasses(teacherId);
  const classes = await Promise.all(raw.map(async (c) => {
    const members = await listClassMembers(c._id);
    return {
      ...normalizeClass(c),
      studentCount: members.filter((m) => memberStatus(m) === 'approved').length,
      pendingCount: members.filter((m) => memberStatus(m) === 'pending').length
    };
  }));
  const selected = classes[0];
  const list = selected ? await students(teacherId, { classId: selected.id }) : { data: [] };
  const pending = selected ? await joinRequests(teacherId, { classId: selected.id }) : { data: [] };
  let notebookCount = 0;
  try {
    notebookCount = (await db.collection('class_notebooks').where({ teacherId, isDeleted: false }).count()).total;
  } catch (e) {
    notebookCount = 0;
  }
  const assignmentCount = (await db.collection('assignments').where({ teacherId, isDeleted: false }).count()).total;
  return {
    success: true,
    data: {
      classes,
      students: list.data || [],
      pendingStudents: pending.data || [],
      studentCount: classes.reduce((n, c) => n + (c.studentCount || 0), 0),
      pendingCount: classes.reduce((n, c) => n + (c.pendingCount || 0), 0),
      assignmentCount,
      notebookCount
    }
  };
}

async function createClass(teacherId, event) {
  const name = String(event.name || '').trim();
  if (!name) return fail('请输入班级名称');
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const now = new Date().toISOString();
  const r = await db.collection('classes').add({
    data: { teacherId, name, joinCode: code, isDeleted: false, createdAt: now, updatedAt: now }
  });
  return { success: true, data: { id: r._id, name, joinCode: code, studentCount: 0 } };
}

async function students(teacherId, event) {
  const classId = event.classId;
  await assertOwnedClass(teacherId, classId);
  const members = await approvedMembers(classId);
  if (!members.length) return { success: true, data: [] };
  const ids = members.map((m) => m.studentId);
  const users = await db.collection('users').where({ _id: _.in(ids) }).get();
  const questions = await Promise.all(ids.map((id) =>
    db.collection('questions').where({ openid: id, isDeleted: false }).count().then((x) => x.total).catch(() => 0)
  ));
  const userMap = {};
  (users.data || []).forEach((u) => { userMap[u._id] = u; });
  return {
    success: true,
    data: ids.map((id, i) => {
      const u = userMap[id] || {};
      return {
        id,
        nickName: u.nickName || '',
        avatarFileID: u.avatarFileID || '',
        questionCount: questions[i] || 0,
        lastActiveAt: u.updatedAt || ''
      };
    })
  };
}

async function studentQuestions(teacherId, event) {
  const studentId = String(event.studentId || '');
  const classId = String(event.classId || '');
  await assertOwnedClass(teacherId, classId);
  const member = await findMembership(classId, studentId);
  if (memberStatus(member) !== 'approved') {
    return fail(memberStatus(member) === 'pending' ? '加入申请待老师审核' : '学生不在该班级');
  }
  const r = await db.collection('questions').where({ openid: studentId, isDeleted: false }).orderBy('createdAt', 'desc').limit(50).get();
  return { success: true, data: (r.data || []).map(mapQuestion) };
}

async function studentOverview(teacherId, event) {
  const classId = String(event.classId || '');
  const studentId = String(event.studentId || '');
  if (!studentId) return fail('缺少学生');
  const cls = await assertOwnedClass(teacherId, classId);
  const member = await findMembership(classId, studentId);
  if (memberStatus(member) !== 'approved') {
    return fail(memberStatus(member) === 'pending' ? '加入申请待老师审核' : '学生不在该班级');
  }
  const users = (await db.collection('users').where({ _id: studentId }).limit(1).get()).data || [];
  const user = users[0] || {};
  const qrows = (await db.collection('questions').where({ openid: studentId, isDeleted: false }).orderBy('createdAt', 'desc').limit(100).get()).data || [];
  const questions = qrows.map((q) => ({ ...mapQuestion(q), createdAt: q.createdAt || '' }));
  const catMap = {};
  questions.forEach((q) => {
    const cat = q.category || '未分类';
    catMap[cat] = (catMap[cat] || 0) + 1;
  });
  const total = questions.length;
  const categories = Object.keys(catMap).map((name) => ({
    name,
    count: catMap[name],
    pct: total ? Math.round((catMap[name] * 100) / total) : 0
  })).sort((a, b) => b.count - a.count);
  const assignments = (await db.collection('assignments').where({ classId, isDeleted: false }).orderBy('createdAt', 'desc').limit(50).get()).data || [];
  const subs = studentId
    ? ((await db.collection('assignment_submissions').where({ studentId }).get()).data || [])
    : [];
  const subByA = {};
  subs.forEach((s) => {
    if (s.assignmentId) subByA[s.assignmentId] = s;
  });
  const homework = assignments.map((a) => {
    const s = subByA[a._id];
    let status = '未交';
    let statusKey = 'missing';
    if (s) {
      if (s.status === 'graded') {
        status = typeof s.score === 'number' ? `已批改 ${s.score}分` : '已批改';
        statusKey = 'graded';
      } else {
        status = '已交待批';
        statusKey = 'submitted';
      }
    }
    return {
      id: a._id,
      title: a.title,
      questionCount: (a.questionIds || []).length,
      dueAt: a.dueAt || '',
      status,
      statusKey,
      score: s && typeof s.score === 'number' ? s.score : null
    };
  });
  return {
    success: true,
    data: {
      student: {
        id: studentId,
        nickName: user.nickName || '未设置昵称',
        avatarFileID: user.avatarFileID || '',
        lastActiveAt: user.updatedAt || '',
        joinedAt: member.createdAt || ''
      },
      className: cls.name,
      classId,
      questionCount: total,
      assignmentCount: homework.length,
      submittedCount: homework.filter((h) => h.statusKey !== 'missing').length,
      missingCount: homework.filter((h) => h.statusKey === 'missing').length,
      categories,
      weak: categories.slice(0, 3),
      questions,
      homework
    }
  };
}

async function teacherQuestions(teacherId, event) {
  const classes = await ownedClasses(teacherId);
  const classIds = classes.map((c) => c._id);
  const target = event.classId && classIds.includes(String(event.classId)) ? String(event.classId) : (classIds[0] || '');
  if (!target) return { success: true, data: { classId: '', questions: [], stats: [] } };
  const studentIds = await classStudentIds(target);
  const rows = await questionsByOpenIds(studentIds, 100);
  const users = studentIds.length
    ? ((await db.collection('users').where({ _id: _.in(studentIds) }).get()).data || [])
    : [];
  const names = {};
  users.forEach((u) => { names[u._id] = u.nickName || ''; });
  return {
    success: true,
    data: {
      classId: target,
      questions: rows.map((q) => ({
        ...mapQuestion(q),
        nickName: names[q.openid] || '未设置昵称'
      }))
    }
  };
}

async function classStats(teacherId, event) {
  const classes = await ownedClasses(teacherId);
  const classIds = classes.map((c) => c._id);
  const target = event.classId && classIds.includes(String(event.classId)) ? String(event.classId) : (classIds[0] || '');
  if (!target) return { success: true, data: { classId: '', total: 0, byCategory: [], hot: [] } };
  const studentIds = await classStudentIds(target);
  const rows = await questionsByOpenIds(studentIds, 200);
  const catMap = {};
  const hotMap = {};
  rows.forEach((q) => {
    const cat = q.category || '未分类';
    catMap[cat] = (catMap[cat] || 0) + 1;
    const key = contentKey(q.content) || q._id;
    if (!hotMap[key]) {
      hotMap[key] = {
        key,
        content: q.content || '',
        category: cat,
        difficulty: q.difficulty || 'MEDIUM',
        count: 0,
        questionIds: [],
        students: {}
      };
    }
    hotMap[key].count += 1;
    hotMap[key].questionIds.push(q._id);
    if (q.openid) hotMap[key].students[q.openid] = true;
  });
  const byCategory = Object.keys(catMap).map((name) => ({ name, count: catMap[name] })).sort((a, b) => b.count - a.count);
  const hot = Object.keys(hotMap).map((k) => {
    const item = hotMap[k];
    return {
      content: item.content,
      category: item.category,
      difficulty: item.difficulty,
      count: item.count,
      studentCount: Object.keys(item.students).length,
      questionId: item.questionIds[0],
      questionIds: item.questionIds
    };
  }).sort((a, b) => b.count - a.count || b.studentCount - a.studentCount).slice(0, 20);
  return {
    success: true,
    data: {
      classId: target,
      total: rows.length,
      studentCount: studentIds.length,
      byCategory,
      hot
    }
  };
}

async function publishNotebook(teacherId, event) {
  const classId = String(event.classId || '');
  const title = String(event.title || '班级错题练习').trim();
  const ids = Array.isArray(event.questionIds) ? event.questionIds.filter(Boolean) : [];
  if (!ids.length) return fail('请选择题目');
  await assertOwnedClass(teacherId, classId);
  const now = new Date().toISOString();
  const r = await db.collection('class_notebooks').add({
    data: { teacherId, classId, title, questionIds: ids, isDeleted: false, createdAt: now, updatedAt: now }
  });
  return { success: true, data: { id: r._id, title, questionCount: ids.length, createdAt: now } };
}

async function savePaper(teacherId, event) {
  const classId = String(event.classId || '');
  const title = String(event.title || '班级试卷').trim();
  const ids = Array.isArray(event.questionIds) ? event.questionIds.filter(Boolean) : [];
  if (!ids.length) return fail('请选择题目');
  await assertOwnedClass(teacherId, classId);
  const now = new Date().toISOString();
  const r = await db.collection('class_papers').add({
    data: {
      teacherId,
      classId,
      title,
      questionIds: ids,
      duration: Number(event.duration) || 90,
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    }
  });
  return { success: true, data: { id: r._id, title, questionCount: ids.length, createdAt: now } };
}

async function listPapers(teacherId, event) {
  const classId = event.classId ? String(event.classId) : '';
  const where = { teacherId, isDeleted: false };
  if (classId) {
    await assertOwnedClass(teacherId, classId);
    where.classId = classId;
  }
  const r = await db.collection('class_papers').where(where).orderBy('createdAt', 'desc').limit(50).get();
  return {
    success: true,
    data: (r.data || []).map((p) => ({
      id: p._id,
      title: p.title,
      classId: p.classId,
      questionCount: (p.questionIds || []).length,
      questionIds: p.questionIds || [],
      duration: p.duration || 90,
      createdAt: p.createdAt
    }))
  };
}

async function listNotebooks(teacherId, event) {
  const classId = event.classId ? String(event.classId) : '';
  const where = { teacherId, isDeleted: false };
  if (classId) {
    await assertOwnedClass(teacherId, classId);
    where.classId = classId;
  }
  try {
    const r = await db.collection('class_notebooks').where(where).orderBy('createdAt', 'desc').limit(50).get();
    return {
      success: true,
      data: (r.data || []).map((n) => ({
        id: n._id,
        title: n.title,
        classId: n.classId,
        questionCount: (n.questionIds || []).length,
        createdAt: n.createdAt
      }))
    };
  } catch (e) {
    return { success: true, data: [] };
  }
}

async function paperDetail(teacherId, event) {
  const id = String(event.id || event.paperId || '');
  if (!id) return fail('缺少试卷');
  const p = (await db.collection('class_papers').doc(id).get()).data;
  if (!p || p.teacherId !== teacherId || p.isDeleted) return fail('无权查看该试卷');
  const questions = await questionsByIds(p.questionIds || []);
  return {
    success: true,
    data: {
      id: p._id,
      type: 'paper',
      title: p.title,
      classId: p.classId,
      questionCount: questions.length,
      createdAt: p.createdAt,
      questions
    }
  };
}

async function notebookDetail(teacherId, event) {
  const id = String(event.id || event.notebookId || '');
  if (!id) return fail('缺少错题本');
  const n = (await db.collection('class_notebooks').doc(id).get()).data;
  if (!n || n.teacherId !== teacherId || n.isDeleted) return fail('无权查看该错题本');
  const questions = await questionsByIds(n.questionIds || []);
  return {
    success: true,
    data: {
      id: n._id,
      type: 'notebook',
      title: n.title,
      classId: n.classId,
      questionCount: questions.length,
      createdAt: n.createdAt,
      questions
    }
  };
}

async function createAssignment(teacherId, event) {
  const classId = String(event.classId || '');
  const title = String(event.title || '班级作业').trim();
  let ids = Array.isArray(event.questionIds) ? event.questionIds.filter(Boolean) : [];
  if (!ids.length && event.paperId) {
    const p = (await db.collection('class_papers').doc(String(event.paperId)).get()).data;
    if (!p || p.teacherId !== teacherId || p.isDeleted) return fail('无权使用该试卷');
    if (p.classId && p.classId !== classId) return fail('试卷不属于该班级');
    ids = p.questionIds || [];
  }
  if (!ids.length) return fail('请选择题目');
  await assertOwnedClass(teacherId, classId);
  const now = new Date().toISOString();
  const dueAt = String(event.dueAt || '').trim();
  const r = await db.collection('assignments').add({
    data: { teacherId, classId, title, questionIds: ids, dueAt, isDeleted: false, createdAt: now, updatedAt: now }
  });
  return { success: true, data: { id: r._id, title, questionCount: ids.length, dueAt, createdAt: now } };
}

async function assignmentSubmissions(teacherId, event) {
  const detail = await assignmentDetail(teacherId, event);
  if (!detail.success) return detail;
  return { success: true, data: (detail.data.roster || []).filter((s) => s.statusKey !== 'missing') };
}

async function assignmentDetail(teacherId, event) {
  const id = String(event.assignmentId || event.id || '');
  if (!id) return fail('缺少作业');
  const a = (await db.collection('assignments').doc(id).get()).data;
  if (!a || a.teacherId !== teacherId || a.isDeleted) return fail('无权访问该作业');
  const cls = await assertOwnedClass(teacherId, a.classId);
  const members = await approvedMembers(a.classId);
  const studentIds = members.map((m) => m.studentId);
  const users = studentIds.length ? ((await db.collection('users').where({ _id: _.in(studentIds) }).get()).data || []) : [];
  const names = {};
  users.forEach((u) => { names[u._id] = u.nickName || ''; });
  const subs = (await db.collection('assignment_submissions').where({ assignmentId: a._id }).get()).data || [];
  const subBy = {};
  subs.forEach((s) => { subBy[s.studentId] = s; });
  const order = { submitted: 0, graded: 1, missing: 2 };
  const roster = studentIds.map((sid) => {
    const s = subBy[sid];
    let statusKey = 'missing';
    let status = '未交';
    if (s) {
      if (s.status === 'graded') {
        statusKey = 'graded';
        status = typeof s.score === 'number' ? `已批改 ${s.score}分` : '已批改';
      } else {
        statusKey = 'submitted';
        status = '已交待批';
      }
    }
    return {
      studentId: sid,
      nickName: names[sid] || '未设置昵称',
      mark: String(names[sid] || '学').slice(0, 1),
      statusKey,
      status,
      score: s && typeof s.score === 'number' ? s.score : null,
      answers: (s && s.answers) || [],
      submissionId: s ? s._id : '',
      submittedAt: (s && (s.submittedAt || s.createdAt)) || ''
    };
  }).sort((x, y) => (order[x.statusKey] || 9) - (order[y.statusKey] || 9));
  const questions = await questionsByIds(a.questionIds || []);
  return {
    success: true,
    data: {
      id: a._id,
      title: a.title,
      classId: a.classId,
      className: cls.name,
      dueAt: a.dueAt || '',
      createdAt: a.createdAt,
      questionCount: questions.length,
      questions,
      studentCount: roster.length,
      submitted: roster.filter((x) => x.statusKey !== 'missing').length,
      missing: roster.filter((x) => x.statusKey === 'missing').length,
      graded: roster.filter((x) => x.statusKey === 'graded').length,
      roster
    }
  };
}

async function teacherAssignments(teacherId) {
  const r = await db.collection('assignments').where({ teacherId, isDeleted: false }).orderBy('createdAt', 'desc').limit(50).get();
  const list = r.data || [];
  if (!list.length) return { success: true, data: [] };
  const classIds = Array.from(new Set(list.map((a) => a.classId).filter(Boolean)));
  const classes = classIds.length ? ((await db.collection('classes').where({ _id: _.in(classIds) }).get()).data || []) : [];
  const classNames = {};
  classes.forEach((c) => { classNames[c._id] = c.name; });
  const classSize = {};
  await Promise.all(classIds.map(async (id) => {
    classSize[id] = (await approvedMembers(id)).length;
  }));
  const aIds = list.map((a) => a._id);
  const subs = [];
  for (let i = 0; i < aIds.length; i += 20) {
    const part = aIds.slice(i, i + 20);
    const s = await db.collection('assignment_submissions').where({ assignmentId: _.in(part) }).get();
    subs.push(...(s.data || []));
  }
  const byA = {};
  subs.forEach((s) => {
    if (!byA[s.assignmentId]) byA[s.assignmentId] = [];
    byA[s.assignmentId].push(s);
  });
  return {
    success: true,
    data: list.map((a) => {
      const rows = byA[a._id] || [];
      const studentCount = classSize[a.classId] || 0;
      const submitted = rows.length;
      const graded = rows.filter((x) => x.status === 'graded').length;
      return {
        id: a._id,
        _id: a._id,
        title: a.title,
        classId: a.classId,
        className: classNames[a.classId] || '',
        questionCount: (a.questionIds || []).length,
        questionIds: a.questionIds || [],
        dueAt: a.dueAt || '',
        createdAt: a.createdAt,
        studentCount,
        submitted,
        missing: Math.max(0, studentCount - submitted),
        graded
      };
    })
  };
}

async function gradeAssignment(teacherId, event) {
  const id = String(event.submissionId || '');
  const score = Number(event.score);
  if (!id || Number.isNaN(score) || score < 0) return fail('请输入有效分数');
  const r = await db.collection('assignment_submissions').doc(id).get();
  const sub = r.data;
  if (!sub) return fail('提交记录不存在');
  const a = (await db.collection('assignments').doc(sub.assignmentId).get()).data;
  if (!a || a.teacherId !== teacherId) return fail('无权批改该作业');
  await db.collection('assignment_submissions').doc(id).update({
    data: { score, status: 'graded', gradedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  });
  return { success: true, data: { id, score, status: 'graded' } };
}

async function parentReport(teacherId, event) {
  const classId = String(event.classId || '');
  const cls = await assertOwnedClass(teacherId, classId);
  const members = await approvedMembers(classId);
  const ids = members.map((m) => m.studentId);
  const users = ids.length ? ((await db.collection('users').where({ _id: _.in(ids) }).get()).data || []) : [];
  const assignments = (await db.collection('assignments').where({ classId, isDeleted: false }).get()).data || [];
  const assignmentIds = assignments.map((a) => a._id);
  const submissions = [];
  for (let i = 0; i < assignmentIds.length; i += 20) {
    const part = assignmentIds.slice(i, i + 20);
    const s = await db.collection('assignment_submissions').where({ assignmentId: _.in(part) }).get();
    submissions.push(...(s.data || []));
  }
  const qrows = await questionsByOpenIds(ids, 200);
  const qCount = {};
  const catBy = {};
  const catMap = {};
  const hotMap = {};
  qrows.forEach((q) => {
    const sid = q.openid || '';
    const cat = q.category || '未分类';
    qCount[sid] = (qCount[sid] || 0) + 1;
    if (!catBy[sid]) catBy[sid] = {};
    catBy[sid][cat] = (catBy[sid][cat] || 0) + 1;
    catMap[cat] = (catMap[cat] || 0) + 1;
    const key = contentKey(q.content) || q._id;
    if (!hotMap[key]) hotMap[key] = { content: q.content || '', category: cat, count: 0, students: {} };
    hotMap[key].count += 1;
    if (sid) hotMap[key].students[sid] = true;
  });
  const rows = ids.map((id) => {
    const u = users.find((x) => x._id === id) || {};
    const mine = submissions.filter((s) => s.studentId === id);
    const graded = mine.filter((s) => s.status === 'graded' && typeof s.score === 'number');
    const cats = Object.keys(catBy[id] || {}).map((name) => ({ name, count: catBy[id][name] })).sort((a, b) => b.count - a.count);
    return {
      studentId: id,
      nickName: u.nickName || '未设置昵称',
      questionCount: qCount[id] || 0,
      submitted: mine.length,
      graded: graded.length,
      averageScore: graded.length ? Math.round(graded.reduce((n, s) => n + s.score, 0) / graded.length) : null,
      weak: cats[0] ? cats[0].name : '',
      categories: cats.slice(0, 3)
    };
  });
  const scored = rows.filter((r) => r.averageScore != null);
  const now = new Date().toISOString();
  const report = {
    teacherId,
    classId,
    className: cls.name,
    title: `${cls.name} 学习情况报告`,
    createdAt: now,
    studentCount: ids.length,
    questionTotal: qrows.length,
    assignmentCount: assignments.length,
    classAverage: scored.length ? Math.round(scored.reduce((n, s) => n + s.averageScore, 0) / scored.length) : null,
    byCategory: Object.keys(catMap).map((name) => ({
      name,
      count: catMap[name],
      pct: qrows.length ? Math.round((catMap[name] * 100) / qrows.length) : 0
    })).sort((a, b) => b.count - a.count).slice(0, 8),
    hot: Object.keys(hotMap).map((k) => ({
      content: hotMap[k].content,
      category: hotMap[k].category,
      count: hotMap[k].count,
      studentCount: Object.keys(hotMap[k].students).length
    })).sort((a, b) => b.count - a.count || b.studentCount - a.studentCount).slice(0, 5),
    students: rows
  };
  const saved = await db.collection('parent_reports').add({ data: report });
  return { success: true, data: { id: saved._id, ...report } };
}

async function listParentReports(teacherId, event) {
  const classId = event.classId ? String(event.classId) : '';
  const where = { teacherId };
  if (classId) {
    await assertOwnedClass(teacherId, classId);
    where.classId = classId;
  }
  try {
    const r = await db.collection('parent_reports').where(where).orderBy('createdAt', 'desc').limit(30).get();
    return {
      success: true,
      data: (r.data || []).map((p) => ({
        id: p._id,
        title: p.title,
        classId: p.classId,
        className: p.className,
        createdAt: p.createdAt,
        studentCount: p.studentCount || (p.students || []).length,
        assignmentCount: p.assignmentCount || 0,
        questionTotal: p.questionTotal || 0
      }))
    };
  } catch (e) {
    return { success: true, data: [] };
  }
}

async function parentReportDetail(teacherId, event) {
  const id = String(event.id || event.reportId || '');
  if (!id) return fail('缺少报告');
  const p = (await db.collection('parent_reports').doc(id).get()).data;
  if (!p || p.teacherId !== teacherId) return fail('无权查看该报告');
  return { success: true, data: { id: p._id, ...p } };
}

async function chat(teacherId, event) {
  const classes = await ownedClasses(teacherId);
  const classIds = classes.map((c) => c._id);
  const target = event.classId && classIds.includes(String(event.classId)) ? String(event.classId) : (classIds[0] || '');
  const cls = classes.find((c) => c._id === target);
  const stats = target ? (await classStats(teacherId, { classId: target })).data : null;
  const hotLines = ((stats && stats.hot) || []).slice(0, 8).map((h, i) =>
    `${i + 1}. [${h.category}] ${String(h.content).slice(0, 60)} （${h.count} 次 / ${h.studentCount} 人）`
  ).join('\n');
  const catLines = ((stats && stats.byCategory) || []).slice(0, 8).map((c) => `${c.name} ${c.count} 道`).join('，');
  const system = [
    '你是给老师用的班级教学助手，不是学生答疑老师。',
    '只根据下面的班级错题统计回答：指出高频错题、薄弱学科、适合组卷或布置作业的题目。',
    '用「老师」称呼对方。先给结论，再给可执行建议（例如推哪些题、布置几道作业）。',
    '不要编造数据里没有的题目，不要给学生讲题步骤，除非老师明确问某道题怎么教。',
    cls ? `当前班级：${cls.name}` : '老师还没有班级。请提醒老师先建班并把加入码发给学生。',
    stats ? `错题总数 ${stats.total}，学生 ${stats.studentCount} 人。学科分布：${catLines || '暂无'}。` : '',
    hotLines ? `高频错题：\n${hotLines}` : '还没有可统计的错题。'
  ].filter(Boolean).join('\n');
  const history = Array.isArray(event.messages) ? event.messages.slice(-8) : [];
  const messages = [{ role: 'system', content: system }].concat(
    history.filter((m) => m && m.content && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({ role: m.role, content: String(m.content) }))
  );
  const res = await callDashScope(messages, 0.3);
  const reply = res && res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content;
  if (!reply) return fail((res && res.error && res.error.message) || '教师助手暂时无法回答');
  return { success: true, data: { reply: String(reply).trim(), classId: target } };
}

async function joinRequests(teacherId, event) {
  const classId = String(event.classId || '');
  await assertOwnedClass(teacherId, classId);
  const pending = await pendingMembers(classId);
  if (!pending.length) return { success: true, data: [] };
  return { success: true, data: await mapMemberUsers(pending) };
}

async function approveJoin(teacherId, event) {
  const classId = String(event.classId || '');
  const studentId = String(event.studentId || '');
  if (!studentId) return fail('缺少学生');
  await assertOwnedClass(teacherId, classId);
  const member = await findMembership(classId, studentId);
  if (!member || member.isDeleted) return fail('没有这条申请');
  const now = new Date().toISOString();
  if (memberStatus(member) === 'approved') {
    return { success: true, data: { classId, studentId, alreadyJoined: true } };
  }
  await db.collection('class_members').doc(member._id).update({
    data: { status: 'approved', isDeleted: false, approvedAt: now, updatedAt: now }
  });
  return { success: true, data: { classId, studentId } };
}

async function rejectJoin(teacherId, event) {
  const classId = String(event.classId || '');
  const studentId = String(event.studentId || '');
  if (!studentId) return fail('缺少学生');
  await assertOwnedClass(teacherId, classId);
  const member = await findMembership(classId, studentId);
  if (!member || member.isDeleted) return fail('没有这条申请');
  if (memberStatus(member) === 'approved') return fail('该学生已在班级中');
  const now = new Date().toISOString();
  await db.collection('class_members').doc(member._id).update({
    data: { status: 'rejected', rejectedAt: now, updatedAt: now }
  });
  return { success: true, data: { classId, studentId } };
}

async function joinClass(event) {
  const studentId = openId();
  const joinCode = String(event.joinCode || '').trim().toUpperCase();
  if (!studentId || !joinCode) return fail('请输入班级加入码');
  const r = await db.collection('classes').where({ joinCode, isDeleted: false }).limit(1).get();
  const cls = (r.data || [])[0];
  if (!cls) return fail('加入码无效');
  const existing = await findMembership(cls._id, studentId);
  const status = memberStatus(existing);
  if (status === 'approved') {
    return { success: true, data: { classId: cls._id, name: cls.name, alreadyJoined: true, pending: false } };
  }
  if (status === 'pending') {
    return { success: true, data: { classId: cls._id, name: cls.name, alreadyJoined: false, pending: true } };
  }
  const now = new Date().toISOString();
  const data = {
    classId: cls._id,
    studentId,
    status: 'pending',
    isDeleted: false,
    requestedAt: now,
    updatedAt: now
  };
  if (existing) {
    await db.collection('class_members').doc(existing._id).update({ data });
  } else {
    await db.collection('class_members').add({ data: { ...data, createdAt: now } });
  }
  return { success: true, data: { classId: cls._id, name: cls.name, alreadyJoined: false, pending: true } };
}

async function myClasses() {
  const studentId = openId();
  if (!studentId) return fail('未获取到用户身份');
  const memberships = await db.collection('class_members').where({ studentId, isDeleted: false }).get();
  const classes = await Promise.all((memberships.data || []).map(async (m) => {
    const status = memberStatus(m);
    if (status === 'rejected' || !status) return null;
    const r = await db.collection('classes').doc(m.classId).get();
    const c = r.data;
    if (!c || c.isDeleted) return null;
    const t = await teacherDoc(c.teacherId);
    return {
      id: c._id,
      name: c.name,
      grade: c.grade || '',
      teacherName: (t && t.nickName) || '教师',
      joinedAt: m.createdAt || '',
      status
    };
  }));
  return { success: true, data: classes.filter(Boolean) };
}

async function myNotebooks() {
  const studentId = openId();
  if (!studentId) return fail('未获取到用户身份');
  const ids = await approvedClassIds(studentId);
  if (!ids.length) return { success: true, data: [] };
  const r = await db.collection('class_notebooks').where({ classId: _.in(ids), isDeleted: false }).orderBy('createdAt', 'desc').limit(30).get();
  const notebooks = await Promise.all((r.data || []).map(async (n) => {
    const qs = await db.collection('questions').where({ _id: _.in(n.questionIds || []), isDeleted: false }).get().catch(() => ({ data: [] }));
    const cls = await db.collection('classes').doc(n.classId).get().catch(() => ({ data: null }));
    return {
      id: n._id,
      title: n.title,
      questionCount: (n.questionIds || []).length,
      className: (cls.data && cls.data.name) || '班级',
      createdAt: n.createdAt || '',
      questions: (qs.data || []).map((q) => ({ id: q._id, content: q.content || '' }))
    };
  }));
  return { success: true, data: notebooks };
}

async function myNotebookDetail(event) {
  const studentId = openId();
  const id = String(event.id || event.notebookId || '');
  if (!studentId || !id) return fail('参数不完整');
  const n = (await db.collection('class_notebooks').doc(id).get()).data;
  if (!n || n.isDeleted) return fail('练习不存在');
  const member = await findMembership(n.classId, studentId);
  if (memberStatus(member) !== 'approved') {
    return fail(memberStatus(member) === 'pending' ? '加入申请待老师审核' : '不在该班级');
  }
  const questions = await questionsByIds(n.questionIds || []);
  const cls = await db.collection('classes').doc(n.classId).get().catch(() => ({ data: null }));
  return {
    success: true,
    data: {
      id: n._id,
      title: n.title,
      className: (cls.data && cls.data.name) || '班级',
      createdAt: n.createdAt || '',
      questionCount: questions.length,
      questions
    }
  };
}

async function myAssignments() {
  const studentId = openId();
  if (!studentId) return fail('未获取到用户身份');
  const ids = await approvedClassIds(studentId);
  if (!ids.length) return { success: true, data: [] };
  const r = await db.collection('assignments').where({ classId: _.in(ids), isDeleted: false }).orderBy('createdAt', 'desc').limit(30).get();
  const rows = await Promise.all((r.data || []).map(async (a) => {
    const s = await db.collection('assignment_submissions').where({ assignmentId: a._id, studentId }).limit(1).get();
    const sub = (s.data || [])[0];
    return {
      ...a,
      submissionStatus: (sub && sub.status) || 'pending',
      submissionScore: sub && sub.score == null ? null : sub && sub.score
    };
  }));
  return { success: true, data: rows };
}

async function myAssignmentDetail(event) {
  const studentId = openId();
  const id = String(event.assignmentId || '');
  const a = (await db.collection('assignments').doc(id).get()).data;
  if (!a || a.isDeleted) return fail('作业不存在');
  const member = await findMembership(a.classId, studentId);
  if (memberStatus(member) !== 'approved') {
    return fail(memberStatus(member) === 'pending' ? '加入申请待老师审核' : '不在该班级');
  }
  const q = await db.collection('questions').where({ _id: _.in(a.questionIds || []), isDeleted: false }).get();
  return { success: true, data: { ...a, questions: q.data || [] } };
}

async function submitAssignment(event) {
  const studentId = openId();
  const id = String(event.assignmentId || '');
  if (!studentId || !id) return fail('参数不完整');
  const a = (await db.collection('assignments').doc(id).get()).data;
  if (!a || a.isDeleted) return fail('作业不存在');
  const member = await findMembership(a.classId, studentId);
  if (memberStatus(member) !== 'approved') {
    return fail(memberStatus(member) === 'pending' ? '加入申请待老师审核' : '不在该班级');
  }
  const now = new Date().toISOString();
  const old = await db.collection('assignment_submissions').where({ assignmentId: id, studentId }).limit(1).get();
  const data = { assignmentId: id, studentId, answers: event.answers || [], status: 'submitted', score: null, submittedAt: now, updatedAt: now };
  if ((old.data || [])[0]) await db.collection('assignment_submissions').doc(old.data[0]._id).update({ data });
  else await db.collection('assignment_submissions').add({ data });
  return { success: true, data: { status: 'submitted', submittedAt: now } };
}
