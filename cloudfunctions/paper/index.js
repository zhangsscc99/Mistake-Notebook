const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

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

exports.main = async (event) => {
  const { action } = event;

  try {
    switch (action) {
      case 'list':
        return await listPapers(event);
      case 'save':
        return await savePaper(event);
      case 'get':
        return await getPaper(event);
      case 'delete':
        return await deletePaper(event);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

function getOpenId() {
  const wxContext = cloud.getWXContext();
  return wxContext.OPENID || wxContext.FROM_OPENID || 'anonymous';
}

async function listPapers() {
  const openId = getOpenId();
  const result = await db.collection('papers')
    .where({ openId, isDeleted: false })
    .orderBy('createdAt', 'desc')
    .get();

  return {
    success: true,
    data: (result.data || []).map(normalizePaper)
  };
}

async function getPaper(event) {
  const { id } = event;
  if (!id) {
    return { success: false, error: 'Missing paper id' };
  }

  const result = await db.collection('papers').doc(id).get();
  if (!result.data || result.data.isDeleted) {
    return { success: false, error: 'Paper not found' };
  }

  return { success: true, data: normalizePaper(result.data) };
}

async function savePaper(event) {
  const { paper } = event;
  if (!paper || !paper.title) {
    return { success: false, error: 'Missing paper title' };
  }
  if (!paper.questions || !Array.isArray(paper.questions) || paper.questions.length === 0) {
    return { success: false, error: 'Missing paper questions' };
  }

  const openId = getOpenId();
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

async function deletePaper(event) {
  const { id } = event;
  if (!id) {
    return { success: false, error: 'Missing paper id' };
  }

  await db.collection('papers').doc(id).update({
    data: {
      isDeleted: true,
      updatedAt: new Date().toISOString()
    }
  });

  return { success: true, data: { id, isDeleted: true } };
}
