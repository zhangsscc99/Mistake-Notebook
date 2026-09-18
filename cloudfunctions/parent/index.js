const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function openId() {
  const c = cloud.getWXContext();
  return c.OPENID || c.FROM_OPENID || '';
}

function fail(error) {
  return { success: false, error };
}

function parseDay(s) {
  const v = String(s || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
}

function createdAtRange(from, to) {
  let a = parseDay(from);
  let b = parseDay(to);
  if (!a && !b) return null;
  if (a && !b) b = a;
  if (b && !a) a = b;
  if (a > b) {
    const t = a;
    a = b;
    b = t;
  }
  return {
    gte: new Date(a + 'T00:00:00+08:00').toISOString(),
    lte: new Date(b + 'T23:59:59.999+08:00').toISOString(),
    gteMs: Date.parse(a + 'T00:00:00+08:00'),
    lteMs: Date.parse(b + 'T23:59:59.999+08:00')
  };
}

function memberStatus(m) {
  if (!m || m.isDeleted) return '';
  if (m.status === 'pending' || m.status === 'rejected' || m.status === 'approved') return m.status;
  return 'approved';
}

function isPastDue(dueAt) {
  const s = String(dueAt || '').trim();
  if (!s) return false;
  const day = s.indexOf('T') > 0 ? s.split('T')[0] : s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const t = Date.parse(s);
    return Number.isFinite(t) && Date.now() > t;
  }
  const end = Date.parse(day + 'T23:59:59+08:00');
  return Number.isFinite(end) && Date.now() > end;
}

function normalizeMarks(src, n) {
  const out = [];
  src = Array.isArray(src) ? src : [];
  for (let i = 0; i < n; i++) {
    const v = src[i];
    if (v === true || v === 'right' || v === 'correct') out.push('right');
    else if (v === false || v === 'wrong' || v === 'incorrect') out.push('wrong');
    else out.push('');
  }
  return out;
}

async function userDoc(id) {
  try {
    return (await db.collection('users').doc(id).get()).data || null;
  } catch (e) {
    return null;
  }
}

async function uniqueParentCode() {
  for (let i = 0; i < 8; i++) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const hit = await db.collection('users').where({ parentCode: code }).limit(1).get();
    if (!(hit.data || []).length) return code;
  }
  return ('P' + Date.now().toString(36)).slice(-6).toUpperCase();
}

async function ensureStudentParentCode(student) {
  if (!student || !student._id) return '';
  if (student.parentCode) return String(student.parentCode).toUpperCase();
  const code = await uniqueParentCode();
  await db.collection('users').doc(student._id).update({
    data: { parentCode: code, updatedAt: new Date().toISOString() }
  });
  student.parentCode = code;
  return code;
}

async function requireRole(role) {
  const id = openId();
  if (!id) throw new Error('未获取到用户身份');
  const user = await userDoc(id);
  if (!user || user.role !== role) throw new Error(role === 'parent' ? '请用家长身份进入' : '请用学生身份进入');
  return { id, user };
}

async function approvedClassIds(studentId) {
  const r = await db.collection('class_members').where({ studentId, isDeleted: false }).get();
  return (r.data || []).filter((m) => memberStatus(m) === 'approved').map((m) => m.classId).filter(Boolean);
}

async function assertBound(parentId, studentId) {
  if (!studentId) throw new Error('缺少学生');
  const r = await db.collection('parent_bindings').where({
    parentId,
    studentId,
    isDeleted: false
  }).limit(1).get();
  if (!(r.data || []).length) throw new Error('尚未绑定该学生');
  return (r.data || [])[0];
}

async function questionsByIds(ids) {
  const map = {};
  const list = (ids || []).map(String).filter(Boolean);
  for (let i = 0; i < list.length; i += 20) {
    const part = list.slice(i, i + 20);
    const r = await db.collection('questions').where({ _id: _.in(part) }).get();
    (r.data || []).forEach((q) => {
      if (q && !q.isDeleted) map[q._id] = q;
    });
  }
  return list.map((id) => map[id]).filter(Boolean).map((q) => ({
    id: q._id,
    content: q.content || q.recognizedText || '',
    imageUrl: q.imageUrl || '',
    category: q.category || '未分类'
  }));
}

exports.main = async (event) => {
  const action = event && event.action;
  try {
    const studentActions = { myParentCode };
    const parentActions = {
      bindChild,
      unbindChild,
      myChildren,
      childHomework,
      childHomeworkDetail,
      childReports,
      childReportDetail,
      childMistakes
    };
    if (studentActions[action]) return await studentActions[action]();
    if (parentActions[action]) return await parentActions[action](event || {});
    return fail('Unknown action: ' + action);
  } catch (e) {
    console.error(e);
    return fail(e.message || '操作失败');
  }
};

async function myParentCode() {
  const { user } = await requireRole('student');
  const code = await ensureStudentParentCode(user);
  return { success: true, data: { parentCode: code } };
}

async function bindChild(event) {
  const { id: parentId } = await requireRole('parent');
  const code = String(event.parentCode || event.code || '').trim().toUpperCase();
  if (!code) return fail('请输入家长绑定码');
  const found = (await db.collection('users').where({ parentCode: code }).limit(1).get()).data || [];
  const student = found[0];
  if (!student) {
    const cls = (await db.collection('classes').where({ joinCode: code, isDeleted: false }).limit(1).get()).data || [];
    if (cls.length) return fail('这是班级加入码，请用孩子「我的」里的家长绑定码');
    return fail('绑定码无效，请让孩子打开「我的 → 家长绑定码」再试');
  }
  if (student.role === 'teacher' || student.role === 'parent') {
    return fail('这个码对应的不是学生账号');
  }
  if (student._id === parentId) return fail('不能绑定自己');
  const classIds = await approvedClassIds(student._id);
  if (!classIds.length) return fail('该学生还不在任何班级，先让孩子加入班级');
  const existing = (await db.collection('parent_bindings').where({
    parentId,
    studentId: student._id,
    isDeleted: false
  }).limit(1).get()).data || [];
  if (existing.length) {
    return {
      success: true,
      data: { studentId: student._id, nickName: student.nickName || '未设置昵称', alreadyBound: true }
    };
  }
  const now = new Date().toISOString();
  await db.collection('parent_bindings').add({
    data: {
      parentId,
      studentId: student._id,
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    }
  });
  return {
    success: true,
    data: { studentId: student._id, nickName: student.nickName || '未设置昵称', alreadyBound: false }
  };
}

async function unbindChild(event) {
  const { id: parentId } = await requireRole('parent');
  const studentId = String(event.studentId || '');
  const row = await assertBound(parentId, studentId);
  await db.collection('parent_bindings').doc(row._id).update({
    data: { isDeleted: true, updatedAt: new Date().toISOString() }
  });
  return { success: true };
}

async function myChildren() {
  const { id: parentId } = await requireRole('parent');
  const rows = (await db.collection('parent_bindings').where({ parentId, isDeleted: false }).get()).data || [];
  const ids = rows.map((r) => r.studentId).filter(Boolean);
  if (!ids.length) return { success: true, data: [] };
  const users = (await db.collection('users').where({ _id: _.in(ids) }).get()).data || [];
  const byId = {};
  users.forEach((u) => { byId[u._id] = u; });
  const children = [];
  for (const id of ids) {
    const u = byId[id] || {};
    const classIds = await approvedClassIds(id);
    children.push({
      studentId: id,
      nickName: u.nickName || '未设置昵称',
      mark: String(u.nickName || '孩').slice(0, 1),
      classCount: classIds.length
    });
  }
  return { success: true, data: children };
}

async function childHomework(event) {
  const { id: parentId } = await requireRole('parent');
  const studentId = String(event.studentId || '');
  await assertBound(parentId, studentId);
  const classIds = await approvedClassIds(studentId);
  if (!classIds.length) return { success: true, data: [] };
  const r = await db.collection('assignments').where({ classId: _.in(classIds), isDeleted: false }).orderBy('createdAt', 'desc').limit(40).get();
  const rows = await Promise.all((r.data || []).map(async (a) => {
    const s = await db.collection('assignment_submissions').where({ assignmentId: a._id, studentId }).limit(1).get();
    const sub = (s.data || [])[0];
    const status = (sub && sub.status) || 'pending';
    const overdue = isPastDue(a.dueAt);
    return {
      id: a._id,
      title: a.title || '班级作业',
      dueAt: a.dueAt || '',
      questionCount: (a.questionIds || []).length,
      createdAt: a.createdAt,
      submissionStatus: status,
      submissionScore: sub && typeof sub.score === 'number' ? sub.score : null,
      comment: (sub && sub.comment) || '',
      overdue
    };
  }));
  return { success: true, data: rows };
}

async function childHomeworkDetail(event) {
  const { id: parentId } = await requireRole('parent');
  const studentId = String(event.studentId || '');
  const assignmentId = String(event.assignmentId || event.id || '');
  await assertBound(parentId, studentId);
  if (!assignmentId) return fail('缺少作业');
  const a = (await db.collection('assignments').doc(assignmentId).get()).data;
  if (!a || a.isDeleted) return fail('作业不存在');
  const classIds = await approvedClassIds(studentId);
  if (classIds.indexOf(a.classId) < 0) return fail('无权查看该作业');
  const questions = await questionsByIds(a.questionIds || []);
  const found = await db.collection('assignment_submissions').where({ assignmentId, studentId }).limit(1).get();
  const sub = (found.data || [])[0];
  const status = (sub && sub.status) || 'pending';
  const saved = Array.isArray(sub && sub.answers) ? sub.answers : [];
  const answers = questions.map((_, i) => String(saved[i] != null ? saved[i] : ''));
  const marks = normalizeMarks(sub && sub.marks, questions.length);
  return {
    success: true,
    data: {
      id: a._id,
      title: a.title || '班级作业',
      dueAt: a.dueAt || '',
      questions,
      answers,
      marks,
      submissionStatus: status,
      submissionScore: sub && typeof sub.score === 'number' ? sub.score : null,
      comment: (sub && sub.comment) || '',
      overdue: isPastDue(a.dueAt),
      readOnly: true,
      canSubmit: false
    }
  };
}

function clipStudentSlice(report, studentId) {
  const students = report.students || [];
  const mine = students.find((s) => s.studentId === studentId) || {};
  const cats = Array.isArray(mine.categories) ? mine.categories : [];
  const catTotal = cats.reduce((n, c) => n + (c.count || 0), 0) || (mine.questionCount || 0);
  return {
    id: report._id,
    title: report.title || '学习情况报告',
    className: report.className || '',
    createdAt: report.createdAt || '',
    from: report.from || '',
    to: report.to || '',
    studentCount: report.studentCount || 0,
    questionTotal: report.questionTotal || 0,
    assignmentCount: report.assignmentCount || 0,
    classAverage: report.classAverage == null ? null : report.classAverage,
    byCategory: (report.byCategory || []).map((c) => ({
      name: c.name || '',
      count: c.count || 0,
      pct: c.pct || 0
    })),
    student: {
      nickName: mine.nickName || '未设置昵称',
      questionCount: mine.questionCount || 0,
      submitted: mine.submitted || 0,
      graded: mine.graded || 0,
      averageScore: mine.averageScore == null ? null : mine.averageScore,
      weak: mine.weak || '',
      categories: cats.map((c) => ({
        name: c.name || '',
        count: c.count || 0,
        pct: catTotal ? Math.round(((c.count || 0) * 100) / catTotal) : 0
      }))
    }
  };
}

async function childReports(event) {
  const { id: parentId } = await requireRole('parent');
  const studentId = String(event.studentId || '');
  await assertBound(parentId, studentId);
  const classIds = await approvedClassIds(studentId);
  if (!classIds.length) return { success: true, data: [] };
  const r = await db.collection('parent_reports').where({ classId: _.in(classIds) }).orderBy('createdAt', 'desc').limit(20).get();
  return { success: true, data: (r.data || []).map((row) => clipStudentSlice(row, studentId)) };
}

async function childReportDetail(event) {
  const { id: parentId } = await requireRole('parent');
  const studentId = String(event.studentId || '');
  const reportId = String(event.reportId || event.id || '');
  await assertBound(parentId, studentId);
  if (!reportId) return fail('缺少报告');
  const report = (await db.collection('parent_reports').doc(reportId).get()).data;
  if (!report) return fail('报告不存在');
  const classIds = await approvedClassIds(studentId);
  if (classIds.indexOf(report.classId) < 0) return fail('无权查看该报告');
  return { success: true, data: clipStudentSlice(report, studentId) };
}

async function childMistakes(event) {
  const { id: parentId } = await requireRole('parent');
  const studentId = String(event.studentId || '');
  await assertBound(parentId, studentId);
  const skip = Math.max(0, Number(event.skip) || 0);
  const page = 40;
  const range = createdAtRange(event.from, event.to);
  const cond = { openid: studentId, isDeleted: false };
  if (range) cond.createdAt = _.and(_.gte(range.gte), _.lte(range.lte));
  let rows = [];
  try {
    const r = await db.collection('questions')
      .where(cond)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(page + 1)
      .get();
    rows = r.data || [];
  } catch (e) {
    const r = await db.collection('questions')
      .where({ openid: studentId, isDeleted: false })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(page + 1)
      .get();
    rows = (r.data || []).filter((q) => {
      if (!range) return true;
      const t = Date.parse(q.createdAt || '');
      return Number.isFinite(t) && t >= range.gteMs && t <= range.lteMs;
    });
  }
  rows = rows.filter((q) => q.source !== 'teacher_bank');
  const hasMore = rows.length > page;
  rows = rows.slice(0, page);
  let total = 0;
  let byCategory = [];
  if (skip === 0) {
    let stats = [];
    try {
      const s = await db.collection('questions')
        .where(cond)
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get();
      stats = (s.data || []).filter((q) => q.source !== 'teacher_bank');
    } catch (e) {
      stats = [];
    }
    if (range && !stats.length) {
      const all = (await db.collection('questions').where({ openid: studentId, isDeleted: false }).orderBy('createdAt', 'desc').limit(200).get()).data || [];
      stats = all.filter((q) => {
        if (q.source === 'teacher_bank') return false;
        const t = Date.parse(q.createdAt || '');
        return Number.isFinite(t) && t >= range.gteMs && t <= range.lteMs;
      });
    }
    total = stats.length;
    const catMap = {};
    stats.forEach((q) => {
      const cat = q.category || '未分类';
      catMap[cat] = (catMap[cat] || 0) + 1;
    });
    byCategory = Object.keys(catMap).map((name) => ({
      name,
      count: catMap[name],
      pct: total ? Math.round((catMap[name] * 100) / total) : 0
    })).sort((a, b) => b.count - a.count);
  }
  return {
    success: true,
    data: {
      skip,
      hasMore,
      total,
      byCategory,
      questions: rows.map((q) => ({
        id: q._id,
        content: q.content || q.recognizedText || '',
        category: q.category || '未分类',
        createdAt: q.createdAt || '',
        imageUrl: q.imageUrl || ''
      }))
    }
  };
}
