const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function isPaperReady(q, teacher) {
  if (!q) return false;
  const source = String(q.source || '').toLowerCase();
  if (teacher && source === 'teacher_bank') {
    return !!(q.content || q.recognizedText || '').trim();
  }
  const status = String(q.aiStatus || '').toLowerCase();
  if (status === 'pending' || status === 'processing' || status === 'failed') return false;
  const answer = String(q.aiAnswer || q.answer || '').trim();
  if (!answer || answer === '待补充') return false;
  const analysis = String(q.aiAnalysis || q.analysis || '').trim();
  if (analysis.indexOf('生成异常') >= 0 || analysis.indexOf('AI答案生成异常') >= 0 || analysis.indexOf('无法解析') >= 0) {
    return false;
  }
  return true;
}

function normalizePaper(record) {
  if (!record) return record;
  const id = record.id || record._id || '';
  return {
    ...record,
    id,
    _id: record._id || id,
    questionCount: record.questionCount || (record.questions ? record.questions.length : 0)
  };
}

function getOpenId() {
  const wxContext = cloud.getWXContext();
  return wxContext.OPENID || wxContext.FROM_OPENID || '';
}

function noOpenId() {
  return { success: false, error: 'NO_OPENID', data: { message: '登录状态异常，请重新登录' } };
}

exports.main = async (event) => {
  const { action } = event;
  const openId = getOpenId();
  if (!openId) return noOpenId();

  try {
    switch (action) {
      case 'list':
        return await listPapers(openId);
      case 'save':
        return await savePaper(openId, event);
      case 'get':
        return await getPaper(openId, event);
      case 'delete':
        return await deletePaper(openId, event);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

async function listPapers(openId) {
  const result = await db.collection('papers')
    .where({ openId, isDeleted: false })
    .orderBy('createdAt', 'desc')
    .get();

  return {
    success: true,
    data: (result.data || []).map(normalizePaper)
  };
}

async function getPaper(openId, event) {
  const { id } = event;
  if (!id) {
    return { success: false, error: 'Missing paper id' };
  }

  const result = await db.collection('papers').doc(id).get();
  if (!result.data || result.data.isDeleted || result.data.openId !== openId) {
    return { success: false, error: 'Paper not found' };
  }

  return { success: true, data: normalizePaper(result.data) };
}

async function savePaper(openId, event) {
  const { paper } = event;
  if (!paper || !paper.title) {
    return { success: false, error: 'Missing paper title' };
  }
  if (!paper.questions || !Array.isArray(paper.questions) || paper.questions.length === 0) {
    return { success: false, error: 'Missing paper questions' };
  }

  const ids = paper.questions.map((q) => q.id || q._id).filter(Boolean).map(String);
  if (!ids.length) {
    return { success: false, error: '试卷题目缺少有效编号' };
  }
  const owned = [];
  const _ = db.command;
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    const res = await db.collection('questions').where({
      _id: _.in(chunk),
      openid: openId,
      isDeleted: false
    }).get();
    owned.push(...(res.data || []));
  }
  const byId = {};
  owned.forEach((q) => { byId[String(q._id)] = q; });
  for (const id of ids) {
    const doc = byId[id];
    if (!doc) {
      return { success: false, error: '题目不存在或不属于当前用户' };
    }
    if (!isPaperReady(doc, false)) {
      return { success: false, error: '未解析完成的题目不能加入组卷' };
    }
  }

  const now = new Date().toISOString();
  const data = {
    openId,
    title: paper.title.trim(),
    questionCount: paper.questions.length,
    questions: paper.questions.map((q) => ({
      id: q.id,
      content: q.content || q.recognizedText || '',
      answer: q.answer || q.aiAnswer || '待补充',
      analysis: q.analysis || q.aiAnalysis || 'AI暂未给出解析',
      categoryId: q.categoryId || '',
      categoryName: q.categoryName || q.category || '',
      tags: q.tags || [],
      difficulty: q.difficulty || 'medium'
    })),
    duration: paper.duration || 90,
    totalScore: paper.totalScore || paper.questions.length * 5,
    createdAt: paper.createdAt || now,
    updatedAt: now,
    isDeleted: false
  };

  const result = await db.collection('papers').add({ data });
  return {
    success: true,
    data: normalizePaper({ _id: result._id, ...data })
  };
}

async function deletePaper(openId, event) {
  const { id } = event;
  if (!id) {
    return { success: false, error: 'Missing paper id' };
  }

  const existing = await db.collection('papers').doc(id).get();
  if (!existing.data || existing.data.isDeleted || existing.data.openId !== openId) {
    return { success: false, error: 'Paper not found' };
  }

  await db.collection('papers').doc(id).update({
    data: {
      isDeleted: true,
      updatedAt: new Date().toISOString()
    }
  });

  return { success: true, data: { id, isDeleted: true } };
}
