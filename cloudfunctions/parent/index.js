const cloud = require('wx-server-sdk');
const https = require('https');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL || 'qwen-plus';
const DEFAULT_CATEGORY_NAMES = [
  '数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '计算机/编程', '政治'
];
const DIFFICULTY_MAP = { '简单': 'EASY', '中等': 'MEDIUM', '困难': 'HARD', EASY: 'EASY', MEDIUM: 'MEDIUM', HARD: 'HARD' };

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

function clipAnswerText(v) {
  if (v && typeof v === 'object') return String(v.text || v.answer || v.value || '').slice(0, 2000);
  return String(v == null ? '' : v).slice(0, 2000);
}

function clipAnswerImage(v) {
  if (v && typeof v === 'object') v = v.image || v.imageFileID || v.url || '';
  const s = String(v || '').trim();
  if (!s) return '';
  if (s.indexOf('cloud://') === 0) return s.slice(0, 400);
  if (s.indexOf('https://') === 0 || s.indexOf('http://') === 0) return s.slice(0, 600);
  return '';
}

function padAnswers(raw, n) {
  const src = Array.isArray(raw) ? raw : [];
  const out = [];
  for (let i = 0; i < n; i++) out.push(clipAnswerText(src[i]));
  return out;
}

function padAnswerImages(raw, answers, n) {
  const src = Array.isArray(raw) ? raw : [];
  const ans = Array.isArray(answers) ? answers : [];
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(clipAnswerImage(src[i]) || clipAnswerImage(ans[i]));
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
      childMistakes,
      childCategories,
      saveChildQuestions,
      childPapers,
      saveChildPaper,
      childChat,
      retryChildQuestion
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
  const n = questions.length;
  const answers = padAnswers(sub && sub.answers, n);
  const answerImages = padAnswerImages(sub && sub.answerImages, sub && sub.answers, n);
  const marks = normalizeMarks(sub && sub.marks, n);
  return {
    success: true,
    data: {
      id: a._id,
      title: a.title || '班级作业',
      dueAt: a.dueAt || '',
      questions,
      answers,
      answerImages,
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
  let pendingCount = 0;
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
    pendingCount = stats.filter((q) => {
      const s = String(q.aiStatus || '').toLowerCase();
      return s === 'pending' || s === 'processing' || s === 'failed';
    }).length;
  }
  return {
    success: true,
    data: {
      skip,
      hasMore,
      total,
      pendingCount,
      byCategory,
      questions: rows.map((q) => ({
        id: q._id,
        content: q.content || q.recognizedText || '',
        category: q.category || '未分类',
        categoryId: q.categoryId || '',
        difficulty: q.difficulty || 'MEDIUM',
        tags: q.tags || [],
        createdAt: q.createdAt || '',
        imageUrl: q.imageUrl || '',
        aiStatus: q.aiStatus || '',
        aiAnswer: q.aiAnswer || q.answer || '',
        aiAnalysis: q.aiAnalysis || q.analysis || '',
        ready: isPaperReady(q)
      }))
    }
  };
}

function isPaperReady(q) {
  if (!q) return false;
  const status = String(q.aiStatus || '').toLowerCase();
  if (status === 'pending' || status === 'processing' || status === 'failed') return false;
  const answer = String(q.aiAnswer || q.answer || '').trim();
  if (!answer || answer === '待补充') return false;
  const analysis = String(q.aiAnalysis || q.analysis || '').trim();
  if (analysis.indexOf('生成异常') >= 0 || analysis.indexOf('AI答案生成异常') >= 0 || analysis.indexOf('无法解析') >= 0) {
    return false;
  }
  return !!(q.content || q.recognizedText || '').trim() && (!status || status === 'ready' || answer);
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

async function ensureChildCategory(studentId, name) {
  const n = String(name || '').trim() || '未分类';
  const found = await db.collection('categories').where({
    openid: studentId,
    name: n,
    isDeleted: false
  }).limit(1).get();
  if ((found.data || [])[0]) return found.data[0];
  const now = new Date().toISOString();
  const r = await db.collection('categories').add({
    data: {
      name: n,
      description: n + '相关题目',
      color: '#4A90E2',
      openid: studentId,
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    }
  });
  return { _id: r._id, name: n };
}

async function childCategories(event) {
  const { id: parentId } = await requireRole('parent');
  const studentId = String(event.studentId || '');
  await assertBound(parentId, studentId);
  let rows = ((await db.collection('categories').where({ openid: studentId, isDeleted: false }).limit(50).get()).data || []);
  if (!rows.length) {
    const now = new Date().toISOString();
    await Promise.all(DEFAULT_CATEGORY_NAMES.map((name) => db.collection('categories').add({
      data: {
        name,
        description: name + '相关题目',
        color: '#4A90E2',
        openid: studentId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now
      }
    })));
    rows = ((await db.collection('categories').where({ openid: studentId, isDeleted: false }).limit(50).get()).data || []);
  }
  return {
    success: true,
    data: rows.map((c) => ({ id: c._id, _id: c._id, name: c.name }))
  };
}

async function saveChildQuestions(event) {
  const { id: parentId } = await requireRole('parent');
  const studentId = String(event.studentId || '');
  await assertBound(parentId, studentId);
  const items = Array.isArray(event.questions) ? event.questions : [];
  if (!items.length) return fail('请选择题目');
  const cat = await ensureChildCategory(studentId, event.category);
  const difficulty = DIFFICULTY_MAP[event.difficulty] || 'MEDIUM';
  const now = new Date().toISOString();
  const saved = [];
  for (const item of items.slice(0, 40)) {
    const content = String(item.text || item.content || '').trim();
    if (!content) continue;
    const tags = [];
    if (item.type) tags.push(item.type);
    if (item.subject) tags.push(item.subject);
    const data = {
      openid: studentId,
      addedBy: parentId,
      source: 'parent_help',
      content,
      imageUrl: item.imageUrl || event.imageUrl || '',
      pageFileIDs: Array.isArray(item.pageFileIDs) ? item.pageFileIDs : [],
      pageSpans: Array.isArray(item.pageSpans) ? item.pageSpans : [],
      categoryId: cat._id || '',
      category: cat.name,
      difficulty,
      tags,
      ocrConfidence: Number(item.confidence) || 0,
      aiAnswer: '',
      aiAnalysis: '',
      aiStatus: 'pending',
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    };
    const r = await db.collection('questions').add({ data });
    saved.push({ id: r._id, ...data });
  }
  if (!saved.length) return fail('没有可保存的题目');
  cloud.callFunction({ name: 'answerWorker', data: { action: 'processPending' } }).catch(() => {});
  return { success: true, data: { savedCount: saved.length, questions: saved } };
}

async function retryChildQuestion(event) {
  const { id: parentId } = await requireRole('parent');
  const studentId = String(event.studentId || '');
  const id = String(event.id || '');
  await assertBound(parentId, studentId);
  if (!id) return fail('缺少题目');
  let doc = null;
  try {
    doc = (await db.collection('questions').doc(id).get()).data;
  } catch (e) {
    doc = null;
  }
  if (!doc || doc.isDeleted || doc.openid !== studentId) return fail('题目不存在或不属于这个孩子');
  const now = new Date().toISOString();
  await db.collection('questions').doc(id).update({
    data: { aiStatus: 'pending', updatedAt: now }
  });
  cloud.callFunction({ name: 'answerWorker', data: { action: 'generate', docId: id } }).catch(() => {});
  return { success: true };
}

async function childPapers(event) {
  const { id: parentId } = await requireRole('parent');
  const studentId = String(event.studentId || '');
  await assertBound(parentId, studentId);
  const r = await db.collection('papers').where({ openId: studentId, isDeleted: false }).orderBy('createdAt', 'desc').limit(50).get();
  return {
    success: true,
    data: (r.data || []).map((p) => ({
      id: p._id,
      title: p.title,
      questionCount: p.questionCount || (p.questions || []).length,
      questions: p.questions || [],
      duration: p.duration || 90,
      totalScore: p.totalScore || 0,
      createdAt: p.createdAt || ''
    }))
  };
}

async function saveChildPaper(event) {
  const { id: parentId } = await requireRole('parent');
  const studentId = String(event.studentId || '');
  await assertBound(parentId, studentId);
  const paper = event.paper || {};
  const title = String(paper.title || '').trim();
  const questions = Array.isArray(paper.questions) ? paper.questions : [];
  if (!title) return fail('请填写试卷名称');
  if (!questions.length) return fail('请选择题目');
  const ids = questions.map((q) => q.id || q._id).filter(Boolean).map(String);
  const owned = [];
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    const res = await db.collection('questions').where({
      _id: _.in(chunk),
      openid: studentId,
      isDeleted: false
    }).get();
    owned.push(...(res.data || []));
  }
  const byId = {};
  owned.forEach((q) => { byId[String(q._id)] = q; });
  const packed = [];
  for (const id of ids) {
    const doc = byId[id];
    if (!doc) return fail('题目不存在或不属于这个孩子');
    if (!isPaperReady(doc)) return fail('未解析完成的题目不能加入组卷');
    packed.push({
      id: doc._id,
      content: doc.content || '',
      answer: doc.aiAnswer || doc.answer || '待补充',
      analysis: doc.aiAnalysis || doc.analysis || 'AI暂未给出解析',
      categoryId: doc.categoryId || '',
      categoryName: doc.category || '',
      tags: doc.tags || [],
      difficulty: doc.difficulty || 'MEDIUM'
    });
  }
  const now = new Date().toISOString();
  const data = {
    openId: studentId,
    addedBy: parentId,
    title,
    questionCount: packed.length,
    questions: packed,
    duration: paper.duration || 90,
    totalScore: paper.totalScore || packed.length * 5,
    createdAt: now,
    updatedAt: now,
    isDeleted: false
  };
  const r = await db.collection('papers').add({ data });
  return { success: true, data: { id: r._id, title, questionCount: packed.length, createdAt: now } };
}

async function childChat(event) {
  const { id: parentId } = await requireRole('parent');
  const studentId = String(event.studentId || '');
  await assertBound(parentId, studentId);
  const student = await userDoc(studentId);
  const name = (student && student.nickName) || '孩子';
  const qs = ((await db.collection('questions').where({
    openid: studentId,
    isDeleted: false
  }).orderBy('createdAt', 'desc').limit(80).get()).data || []).filter((q) => q.source !== 'teacher_bank');
  const catMap = {};
  qs.forEach((q) => {
    const cat = q.category || '未分类';
    catMap[cat] = (catMap[cat] || 0) + 1;
  });
  const catLines = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a])
    .map((n) => n + ' ' + catMap[n] + ' 道').join('，');
  const sample = qs.slice(0, 12).map((q, i) =>
    (i + 1) + '. [' + (q.category || '未分类') + '] ' + String(q.content || '').replace(/\s+/g, ' ').trim().slice(0, 50)
  ).join('\n');
  const classIds = await approvedClassIds(studentId);
  let hwLine = '还没有班级作业记录。';
  if (classIds.length) {
    const asg = ((await db.collection('assignments').where({
      classId: _.in(classIds),
      isDeleted: false
    }).orderBy('createdAt', 'desc').limit(10).get()).data || []);
    const subs = asg.length
      ? ((await db.collection('assignment_submissions').where({
          studentId,
          assignmentId: _.in(asg.map((a) => a._id))
        }).get()).data || [])
      : [];
    const graded = subs.filter((s) => s.status === 'graded' && typeof s.score === 'number');
    const avg = graded.length
      ? Math.round(graded.reduce((n, s) => n + s.score, 0) / graded.length)
      : null;
    hwLine = `最近作业 ${asg.length} 份，已交 ${subs.length} 份` + (avg == null ? '。' : `，已批改均分 ${avg}。`);
  }
  const system = [
    '你是给家长用的学习情况助手，不是替孩子写作业的老师。',
    '根据下面的孩子错题和作业数据，用明白的话说明：错题数量、薄弱学科、最近错在哪类题、家长可以怎么帮。',
    '用「您」称呼家长。先给结论，再给可执行建议（例如今晚复习哪几类题、要不要再拍几张卷子进错题本）。',
    '不要编造数据里没有的题目，不要把整道题的完整解答写出来，除非家长明确问某一题怎么讲给孩子听。',
    `当前孩子：${name}。错题 ${qs.length} 道。学科分布：${catLines || '暂无'}。`,
    hwLine,
    sample ? ('最近错题：\n' + sample) : '还没有可统计的错题。提醒家长先用拍照帮孩子录入。'
  ].filter(Boolean).join('\n');
  const history = Array.isArray(event.messages) ? event.messages.slice(-8) : [];
  const messages = [{ role: 'system', content: system }].concat(
    history.filter((m) => m && m.content && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({ role: m.role, content: String(m.content) }))
  );
  const res = await callDashScope(messages, 0.3);
  const reply = res && res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content;
  if (!reply) return fail((res && res.error && res.error.message) || '助手暂时无法回答');
  return { success: true, data: { reply: String(reply).trim(), studentId } };
}
