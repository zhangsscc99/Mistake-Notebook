const cloud = require('wx-server-sdk');
const https = require('https');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;
const { normalizeQuestion } = require('./normalize');

const MARKS_COLLECTION = 'question_marks';

function mapQuestionList(records) {
  return (records || []).map(normalizeQuestion);
}

function isTeacherBank(q) {
  return String((q && q.source) || '') === 'teacher_bank';
}

function mapStudentQuestions(records) {
  return mapQuestionList((records || []).filter((q) => !isTeacherBank(q)));
}

// 身份只从云端上下文取。错题 / 分类按 openid 隔离，不再是全站共用池。
function getCallerOpenId() {
  const wxContext = cloud.getWXContext();
  return wxContext.OPENID || wxContext.FROM_OPENID || '';
}

function noOpenId() {
  return { success: false, error: 'NO_OPENID', data: { message: '登录状态异常，请重新登录' } };
}

function notFound(msg) {
  return { success: false, error: msg || 'Question not found' };
}

async function loadOwnedQuestion(openId, id) {
  if (!id) return null;
  try {
    const result = await db.collection('questions').doc(String(id)).get();
    const doc = result.data;
    if (!doc || doc.isDeleted) return null;
    if (doc.openid !== openId) return null;
    return doc;
  } catch (e) {
    return null;
  }
}

async function listUserCategories(openId) {
  const result = await db.collection('categories')
    .where({ openid: openId })
    .limit(100)
    .get();
  return (result.data || []).filter((cat) => !cat.isDeleted);
}

function categoryNameKey(name) {
  return String(name || '').replace(/\s+/g, '').toLowerCase();
}

function matchExistingCategory(list, categoryId, categoryName) {
  if (!list || !list.length) return null;
  if (categoryId) {
    const byId = list.find((cat) => String(cat._id) === String(categoryId));
    if (byId) return byId;
  }
  const want = categoryNameKey(categoryName);
  if (!want) return null;
  const exact = list.find((cat) => categoryNameKey(cat.name) === want);
  if (exact) return exact;
  return list.find((cat) => {
    const n = categoryNameKey(cat.name);
    return n && (want.indexOf(n) !== -1 || n.indexOf(want) !== -1);
  }) || null;
}

const DEFAULT_CATEGORIES = [
  { name: '数学', description: '数学相关题目', color: '#E8A855' },
  { name: '物理', description: '物理相关题目', color: '#4A90E2' },
  { name: '化学', description: '化学相关题目', color: '#7ED321' },
  { name: '英语', description: '英语相关题目', color: '#F5A623' },
  { name: '语文', description: '语文相关题目', color: '#BD10E0' },
  { name: '生物', description: '生物相关题目', color: '#50E3C2' },
  { name: '历史', description: '历史相关题目', color: '#D0021B' },
  { name: '地理', description: '地理相关题目', color: '#8B572A' },
  { name: '计算机/编程', description: '计算机与编程相关题目', color: '#2A9D8F' },
  { name: '政治', description: '政治相关题目', color: '#C471ED' }
];

async function seedPersonalCategories(openId) {
  const now = new Date().toISOString();
  for (const cat of DEFAULT_CATEGORIES) {
    const found = await db.collection('categories')
      .where({ openid: openId, name: cat.name, isDeleted: false })
      .limit(1)
      .get();
    if (found.data && found.data.length) continue;
    await db.collection('categories').add({
      data: {
        ...cat,
        openid: openId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now
      }
    });
  }
}

async function findExistingCategory(openId, categoryId, categoryName) {
  let list = await listUserCategories(openId);
  if (!list.length) {
    await seedPersonalCategories(openId);
    list = await listUserCategories(openId);
  }
  return matchExistingCategory(list, categoryId, categoryName) || list[0] || null;
}

exports.main = async (event, context) => {
  const { action } = event;

  try {
    switch (action) {
      case 'create':
        return await createQuestion(event);
      case 'get':
        return await getQuestion(event);
      case 'list':
        return await listQuestions(event);
      case 'page':
        return await pageQuestions(event);
      case 'batch':
        return await batchGetQuestions(event);
      case 'update':
        return await updateQuestion(event);
      case 'delete':
        return await deleteQuestion(event);
      case 'batchDelete':
        return await batchDeleteQuestions(event);
      case 'byCategory':
        return await getQuestionsByCategory(event);
      case 'pending':
        return await listPendingQuestions(event);
      case 'retry':
        return await retryQuestion(event);
      case 'statsCategory':
        return await statsByCategory();
      case 'statsDifficulty':
        return await statsByDifficulty();
      case 'batchSave':
        return await batchSaveQuestions(event);
      case 'generateAnswer':
        return await generateAnswerForQuestion(event);
      case 'mark':
        return await markQuestion(event);
      case 'listMarks':
        return await listMarks(event);
      case 'saveNote':
        return await saveNote(event);
      case 'getNote':
        return await getNote(event);
      case 'listNotes':
        return await listNotes(event);
      case 'saveVariants':
        return await saveVariants(event);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

async function createQuestion(event) {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const { content, imageUrl, category, difficulty, tags, aiAnswer, aiAnalysis } = event;

  const cat = await findExistingCategory(openId, event.categoryId, category);
  const categoryId = cat ? cat._id : '';
  const categoryName = (cat && cat.name) || category || '';

  const now = new Date().toISOString();
  const hasAiContent = !!(aiAnswer || aiAnalysis);
  const questionData = {
    openid: openId,
    content: content || '',
    imageUrl: imageUrl || '',
    pageFileIDs: Array.isArray(event.pageFileIDs) ? event.pageFileIDs : [],
    pageSpans: Array.isArray(event.pageSpans) ? event.pageSpans : [],
    categoryId: categoryId || '',
    category: categoryName,
    difficulty: difficulty || 'MEDIUM',
    tags: tags || [],
    aiConfidence: event.aiConfidence || 0,
    aiAnswer: aiAnswer || '',
    aiAnalysis: aiAnalysis || '',
    aiStatus: event.aiStatus || (hasAiContent ? 'ready' : ''),
    ocrConfidence: event.ocrConfidence || 0,
    isDeleted: false,
    createdAt: now,
    updatedAt: now
  };

  const result = await db.collection('questions').add({
    data: questionData
  });

  if (!event.skipWorkerNudge && questionData.aiStatus === 'pending') {
    nudgeAnswerWorker({ action: 'generate', docId: result._id });
  }

  return { success: true, data: normalizeQuestion({ _id: result._id, ...questionData }) };
}

async function getQuestion(event) {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const { id } = event;
  if (!id) {
    return { success: false, error: 'Missing question id' };
  }

  const doc = await loadOwnedQuestion(openId, id);
  if (!doc) return notFound();

  return { success: true, data: normalizeQuestion(doc) };
}

async function listQuestions(event) {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const { category, difficulty, keyword, tag } = event;
  const conditions = { openid: openId, isDeleted: false };

  if (category) {
    conditions.category = category;
  }
  if (difficulty) {
    conditions.difficulty = difficulty;
  }
  if (keyword) {
    conditions.content = db.RegExp({
      regexp: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      options: 'i'
    });
  }
  if (tag) {
    conditions.tags = _.in([tag]);
  }

  const result = await db.collection('questions')
    .where(conditions)
    .orderBy('createdAt', 'desc')
    .get();

  return { success: true, data: mapStudentQuestions(result.data) };
}

async function pageQuestions(event) {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const { page = 0, size = 20, category, difficulty, keyword } = event;
  const conditions = { openid: openId, isDeleted: false };

  if (category) {
    conditions.category = category;
  }
  if (difficulty) {
    conditions.difficulty = difficulty;
  }
  if (keyword) {
    conditions.content = db.RegExp({
      regexp: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      options: 'i'
    });
  }

  const totalResult = await db.collection('questions')
    .where(conditions)
    .count();

  const result = await db.collection('questions')
    .where(conditions)
    .orderBy('createdAt', 'desc')
    .skip(page * size)
    .limit(size)
    .get();

  return {
    success: true,
    data: {
      records: mapStudentQuestions(result.data),
      total: totalResult.total,
      page,
      size,
      totalPages: Math.ceil(totalResult.total / size)
    }
  };
}

async function batchGetQuestions(event) {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const { ids } = event;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: 'Missing or invalid ids array' };
  }

  const result = await db.collection('questions')
    .where({
      _id: _.in(ids),
      openid: openId,
      isDeleted: false
    })
    .get();

  return { success: true, data: mapStudentQuestions(result.data) };
}

async function updateQuestion(event) {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const { id } = event;
  if (!id) {
    return { success: false, error: 'Missing question id' };
  }

  const owned = await loadOwnedQuestion(openId, id);
  if (!owned) return notFound();

  const updateFields = {};
  const allowedFields = ['content', 'imageUrl', 'categoryId', 'category', 'difficulty', 'tags', 'aiAnswer', 'aiAnalysis', 'aiStatus', 'aiConfidence', 'ocrConfidence'];

  allowedFields.forEach(field => {
    if (event[field] !== undefined) {
      updateFields[field] = event[field];
    }
  });

  updateFields.updatedAt = new Date().toISOString();

  await db.collection('questions')
    .doc(id)
    .update({
      data: updateFields
    });

  return { success: true, data: { _id: id, ...updateFields } };
}

async function deleteQuestion(event) {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const { id } = event;
  if (!id) {
    return { success: false, error: 'Missing question id' };
  }

  const owned = await loadOwnedQuestion(openId, id);
  if (!owned) return notFound();

  await db.collection('questions')
    .doc(id)
    .update({
      data: {
        isDeleted: true,
        updatedAt: new Date().toISOString()
      }
    });

  return { success: true, data: { _id: id, isDeleted: true } };
}

async function batchDeleteQuestions(event) {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const { ids } = event;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: 'Missing or invalid ids array' };
  }

  const now = new Date().toISOString();
  const ownedIds = [];
  for (const id of ids) {
    const doc = await loadOwnedQuestion(openId, id);
    if (doc) ownedIds.push(id);
  }

  const updatePromises = ownedIds.map(id =>
    db.collection('questions')
      .doc(id)
      .update({
        data: {
          isDeleted: true,
          updatedAt: now
        }
      })
  );

  await Promise.all(updatePromises);

  return { success: true, data: { deletedCount: ownedIds.length } };
}

async function resolveCategory(event, openId) {
  const { categoryId, categoryName } = event;
  if (categoryId) {
    try {
      const result = await db.collection('categories').doc(String(categoryId)).get();
      if (result.data && !result.data.isDeleted && result.data.openid === openId) {
        return result.data;
      }
    } catch (e) {
      // fall through
    }
  }

  const name = categoryName || categoryId;
  if (name) {
    const byName = await db.collection('categories')
      .where({ openid: openId, name: String(name), isDeleted: false })
      .limit(1)
      .get();
    if (byName.data.length > 0) {
      return byName.data[0];
    }
  }

  return null;
}

async function getQuestionsByCategory(event) {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const { categoryId, categoryName } = event;
  if (!categoryId && !categoryName) {
    return { success: false, error: 'Missing categoryId' };
  }

  const category = await resolveCategory({ categoryId, categoryName }, openId);
  const settled = _.nin(['pending', 'processing', 'failed']);
  const conditions = [{
    openid: openId,
    categoryId: String(categoryId || ''),
    isDeleted: false,
    aiStatus: settled
  }];

  if (category && category._id) {
    conditions.push({
      openid: openId,
      categoryId: category._id,
      isDeleted: false,
      aiStatus: settled
    });
  }
  if (category && category.name) {
    conditions.push({
      openid: openId,
      category: category.name,
      isDeleted: false,
      aiStatus: settled
    });
  }
  if (categoryName) {
    conditions.push({
      openid: openId,
      category: String(categoryName),
      isDeleted: false,
      aiStatus: settled
    });
  }

  const result = await db.collection('questions')
    .where(_.or(conditions))
    .orderBy('createdAt', 'desc')
    .get();

  return { success: true, data: mapQuestionList(result.data) };
}

async function listPendingQuestions() {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const result = await db.collection('questions')
    .where({
      openid: openId,
      isDeleted: false,
      aiStatus: _.in(['pending', 'processing', 'failed'])
    })
    .orderBy('createdAt', 'desc')
    .get();

  return { success: true, data: mapStudentQuestions(result.data) };
}

async function retryQuestion(event) {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const { id } = event;
  if (!id) {
    return { success: false, error: 'Missing question id' };
  }

  const owned = await loadOwnedQuestion(openId, id);
  if (!owned) return notFound();

  await db.collection('questions')
    .doc(String(id))
    .update({
      data: {
        aiStatus: 'pending',
        aiAnswer: '',
        aiAnalysis: '',
        updatedAt: new Date().toISOString()
      }
    });

  nudgeAnswerWorker({ action: 'generate', docId: id });

  return { success: true, data: { _id: id, aiStatus: 'pending' } };
}

async function statsByCategory() {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const result = await db.collection('questions')
    .aggregate()
    .match({ isDeleted: false, openid: openId })
    .group({
      _id: '$category',
      count: $.sum(1)
    })
    .end();

  return { success: true, data: result.list };
}

async function statsByDifficulty() {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const result = await db.collection('questions')
    .aggregate()
    .match({ isDeleted: false, openid: openId })
    .group({
      _id: '$difficulty',
      count: $.sum(1)
    })
    .end();

  return { success: true, data: result.list };
}

// ─── 收藏 / 置顶 / 已掌握 ─────────────────────────────────────────────────────
//
// 题目已按 openid 隔离，但收藏/置顶仍落在独立集合：每人每题一条，
// 方便列表筛选，也不把标记写进题目文档。
//
// _id 用 `${openid}_${questionId}` 确定性拼接：每人每题只可能有一条，
// doc().set() 天然幂等，不需要事务也不会写重。
const MARK_FIELDS = ['favorite', 'pinned', 'mastered'];

async function markQuestion(event) {
  const openId = getCallerOpenId();
  if (!openId) {
    return { success: false, error: 'No openid' };
  }

  const questionId = String(event.questionId || '').trim();
  if (!questionId) {
    return { success: false, error: 'Missing questionId' };
  }

  // 白名单 + 类型校验。客户端传什么进来都拦不住，这一层才是把关的，
  // 与 user 云函数 updateProfile 的字段白名单是同一套思路
  const patch = {};
  for (const field of MARK_FIELDS) {
    if (event[field] === undefined) continue;
    if (typeof event[field] !== 'boolean') {
      return { success: false, error: `Invalid ${field}` };
    }
    patch[field] = event[field];
  }
  if (Object.keys(patch).length === 0) {
    return { success: false, error: '没有需要更新的标记' };
  }

  const now = new Date().toISOString();
  const _id = `${openId}_${questionId}`;

  // 读一次现有标记，好把这次没传的字段原样保留（只更新传了的）
  const existing = await db.collection(MARKS_COLLECTION).where({ _id }).limit(1).get();
  const current = (existing.data || [])[0];

  const mark = {
    favorite: current ? !!current.favorite : false,
    pinned: current ? !!current.pinned : false,
    mastered: current ? !!current.mastered : false,
    ...patch
  };

  await db.collection(MARKS_COLLECTION).doc(_id).set({
    data: {
      openid: openId,
      questionId,
      ...mark,
      createdAt: (current && current.createdAt) || now,
      updatedAt: now
    }
  });

  return { success: true, data: { questionId, ...mark } };
}

// 给一批题目取当前用户的标记，前端合并进题目对象后渲染。
// 单独一个 action，不去改 byCategory 的返回结构 —— byCategory 还被
// questionPicker / questionSelector 用，给它的响应加字段会让那些调用方白付一次查询
async function listMarks(event) {
  const openId = getCallerOpenId();
  if (!openId) {
    return { success: false, error: 'No openid' };
  }

  const questionIds = (Array.isArray(event.questionIds) ? event.questionIds : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)
    .slice(0, 200); // 防御性上限，不让客户端塞一个巨数组进来

  if (questionIds.length === 0) {
    return { success: true, data: {} };
  }

  const res = await db.collection(MARKS_COLLECTION)
    .where({ openid: openId, questionId: _.in(questionIds) })
    .limit(200)
    .get();

  // 返回 { [questionId]: { favorite, pinned, mastered } }
  const map = {};
  (res.data || []).forEach((doc) => {
    map[doc.questionId] = {
      favorite: !!doc.favorite,
      pinned: !!doc.pinned,
      mastered: !!doc.mastered
    };
  });

  return { success: true, data: map };
}

// ─── 错题批注 / 笔记 ─────────────────────────────────────────────────────────
//
// 与 question_marks 同一个道理：笔记是「每人对每题一条」
// 的私有数据，必须落在独立集合 question_notes，_id 用 `${openid}_${questionId}`
// 确定性拼接，doc().set() 幂等。
const NOTES_COLLECTION = 'question_notes';
const MAX_NOTE_LEN = 2000;

async function saveNote(event) {
  const openId = getCallerOpenId();
  if (!openId) {
    return { success: false, error: 'No openid' };
  }

  const questionId = String(event.questionId || '').trim();
  if (!questionId) {
    return { success: false, error: 'Missing questionId' };
  }

  const note = String(event.note == null ? '' : event.note).trim().slice(0, MAX_NOTE_LEN);
  const now = new Date().toISOString();
  const _id = `${openId}_${questionId}`;

  // 清空笔记 = 删除记录，不留空文档
  if (!note) {
    try {
      await db.collection(NOTES_COLLECTION).doc(_id).remove();
    } catch (e) {
      // 本来就不存在，视为成功
    }
    return { success: true, data: { questionId, note: '', updatedAt: '' } };
  }

  const existing = await db.collection(NOTES_COLLECTION).where({ _id }).limit(1).get();
  const current = (existing.data || [])[0];

  await db.collection(NOTES_COLLECTION).doc(_id).set({
    data: {
      openid: openId,
      questionId,
      note,
      createdAt: (current && current.createdAt) || now,
      updatedAt: now
    }
  });

  return { success: true, data: { questionId, note, updatedAt: now } };
}

async function getNote(event) {
  const openId = getCallerOpenId();
  if (!openId) {
    return { success: false, error: 'No openid' };
  }

  const questionId = String(event.questionId || '').trim();
  if (!questionId) {
    return { success: false, error: 'Missing questionId' };
  }

  const res = await db.collection(NOTES_COLLECTION)
    .where({ _id: `${openId}_${questionId}` })
    .limit(1)
    .get();
  const doc = (res.data || [])[0];

  return {
    success: true,
    data: { questionId, note: (doc && doc.note) || '', updatedAt: (doc && doc.updatedAt) || '' }
  };
}

// 给一批题目取当前用户的笔记（用于列表上的「有笔记」角标），与 listMarks 同构
async function listNotes(event) {
  const openId = getCallerOpenId();
  if (!openId) {
    return { success: false, error: 'No openid' };
  }

  const questionIds = (Array.isArray(event.questionIds) ? event.questionIds : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)
    .slice(0, 200);

  if (questionIds.length === 0) {
    return { success: true, data: {} };
  }

  const res = await db.collection(NOTES_COLLECTION)
    .where({ openid: openId, questionId: _.in(questionIds) })
    .limit(200)
    .get();

  const map = {};
  (res.data || []).forEach((doc) => {
    map[doc.questionId] = { note: doc.note || '', updatedAt: doc.updatedAt || '' };
  });

  return { success: true, data: map };
}

// ─── 变式题入库 ──────────────────────────────────────────────────────────────
//
// answer 云函数的 generateVariants 只生成不入库；学生在前端勾选确认后，
// 由这里写入题库。带 isVariant / sourceQuestionIds 溯源，aiStatus 直接 ready
// （答案解析是生成时一起出的，不需要再走 answerWorker）。
async function saveVariants(event) {
  if (!getCallerOpenId()) return noOpenId();

  const variants = (Array.isArray(event.variants) ? event.variants : [])
    .map((v) => ({
      content: String(v.content || '').trim(),
      answer: String(v.answer || '').trim(),
      analysis: String(v.analysis || '').trim(),
      difficulty: DIFFICULTY_MAP[v.difficulty] || 'MEDIUM',
      knowledgePoint: String(v.knowledgePoint || '').trim().slice(0, 20),
      sourceQuestionId: String(v.sourceQuestionId || '').trim()
    }))
    .filter((v) => v.content && v.answer)
    .slice(0, 10);

  if (variants.length === 0) {
    return { success: false, error: '没有可保存的变式题' };
  }

  const sourceQuestionIds = (Array.isArray(event.sourceQuestionIds) ? event.sourceQuestionIds : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)
    .slice(0, 20);
  const category = String(event.category || '').trim();

  const saved = await Promise.all(
    variants.map(async (v) => {
      const tags = ['变式题'];
      if (v.knowledgePoint) tags.push(v.knowledgePoint);

      const createRes = await createQuestion({
        content: v.content,
        imageUrl: '',
        category,
        difficulty: v.difficulty,
        tags,
        aiConfidence: 0,
        aiAnswer: v.answer,
        aiAnalysis: v.analysis,
        aiStatus: 'ready',
        skipWorkerNudge: true
      });

      if (!createRes.success) return null;

      const newId = createRes.data._id;
      const tracedIds = v.sourceQuestionId ? [v.sourceQuestionId] : sourceQuestionIds;
      try {
        await db.collection('questions').doc(newId).update({
          data: { isVariant: true, sourceQuestionIds: tracedIds }
        });
      } catch (e) {
        console.warn('saveVariants trace fields failed:', newId, e.message);
      }

      return { ...createRes.data, isVariant: true, sourceQuestionIds: tracedIds };
    })
  );

  const savedQuestions = saved.filter(Boolean);
  return {
    success: true,
    data: { savedCount: savedQuestions.length, questions: savedQuestions }
  };
}

const DIFFICULTY_MAP = {
  '简单': 'EASY',
  '中等': 'MEDIUM',
  '困难': 'HARD',
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD'
};

async function invokeFunction(name, data) {
  const res = await cloud.callFunction({ name, data });
  return res.result || {};
}

function nudgeAnswerWorker(data) {
  cloud.callFunction({
    name: 'answerWorker',
    data
  }).catch((err) => {
    console.warn('nudgeAnswerWorker failed:', err && err.message);
  });
}

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DASHSCOPE_MODEL = 'qwen3-vl-flash';

function callDashScope(messages, temperature = 0.2) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: DASHSCOPE_MODEL,
      messages,
      stream: false,
      temperature
    });

    const url = new URL(DASHSCOPE_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`Failed to parse DashScope response: ${e.message}`)); }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function generateAnswerForText(text) {
  const results = await generateAnswersForTexts([text]);
  return results[0] || { answer: '', analysis: '', confidence: 0 };
}

function parseAnswerResult(content) {
  const result = { answer: '', analysis: '', confidence: 0 };
  const raw = String(content || '').trim();

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      result.answer = parsed.answer || '';
      result.analysis = parsed.analysis || '';
      result.confidence = parsed.confidence || 0;
      if (result.answer || result.analysis) {
        return result;
      }
    }
  } catch (e) {
    console.warn('Failed to parse answer JSON, falling back to text', e.message);
  }

  const cleaned = raw.replace(/```json|```/g, '').trim();
  result.analysis = cleaned;
  const m = cleaned.match(/(?:最终答案|答案)[:：]?\s*([^\n]{1,200})/);
  result.answer = m ? m[1].trim() : '';
  return result;
}

async function generateAnswersForTexts(texts) {
  const cleaned = (texts || []).map((t) => String(t || '').trim()).filter(Boolean);
  if (!cleaned.length) return [];

  if (cleaned.length === 1) {
    const prompt = `请解答以下题目，给出解题步骤和最终答案。解析控制在 800 字以内。

题目内容：
${cleaned[0]}

只返回一个纯 JSON 对象，不要输出任何解释文字，不要使用 markdown 代码块（不要出现 \`\`\`）。
JSON 字符串内部的换行用 \\n，遇到反斜杠、双引号、数学符号请正确转义，确保整体可被 JSON.parse 解析。
格式如下：
{
  "answer": "最终的答案",
  "analysis": "详细的解题步骤和分析过程",
  "confidence": 0.0-1.0
}`;
    const response = await callDashScope([{ role: 'user', content: prompt }], 0.2);
    if (!response.choices || response.choices.length === 0) {
      throw new Error('Answer generation failed');
    }
    return [parseAnswerResult(response.choices[0].message.content)];
  }

  const numbered = cleaned.map((text, i) => `【第${i + 1}题】\n${text}`).join('\n\n---\n\n');
  const prompt = `请依次解答以下 ${cleaned.length} 道题目，给出每道题的最终答案和详细解析。

${numbered}

请以 JSON 数组格式返回（不要包含 markdown 代码块标记），数组长度必须为 ${cleaned.length}，顺序与题目一致：
[
  {
    "answer": "第1题的最终答案",
    "analysis": "第1题的详细解题步骤和分析过程",
    "confidence": 0.0-1.0
  }
]`;

  const response = await callDashScope([{ role: 'user', content: prompt }], 0.2);
  if (!response.choices || response.choices.length === 0) {
    throw new Error('Batch answer generation failed');
  }

  const content = response.choices[0].message.content;
  try {
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return cleaned.map((_, i) => ({
          answer: parsed[i]?.answer || '',
          analysis: parsed[i]?.analysis || '',
          confidence: parsed[i]?.confidence || 0
        }));
      }
    }
  } catch (e) {
    console.warn('Batch parse failed, falling back to per-question generation', e.message);
  }

  const fallback = [];
  for (const text of cleaned) {
    try {
      fallback.push(await generateAnswerForText(text));
    } catch (err) {
      console.warn('Fallback answer generation failed', err.message);
      fallback.push({ answer: '', analysis: '', confidence: 0 });
    }
  }
  return fallback;
}

async function generateAnswerForQuestion(event) {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const { id } = event;
  if (!id) {
    return { success: false, error: 'Missing question id' };
  }

  const doc = await loadOwnedQuestion(openId, id);
  if (!doc) return notFound();
  if (doc.aiStatus === 'ready' && doc.aiAnalysis) {
    return { success: true, data: { skipped: true } };
  }

  const text = (doc.content || '').trim();
  if (!text) {
    return { success: false, error: 'Missing question content' };
  }

  let aiAnswer = '';
  let aiAnalysis = '';
  let aiStatus = 'failed';

  try {
    const answerData = await generateAnswerForText(text);
    aiAnswer = answerData.answer || '';
    aiAnalysis = answerData.analysis || '';
    if (aiAnswer || aiAnalysis) {
      aiStatus = 'ready';
    }
  } catch (e) {
    console.warn('generateAnswerForQuestion failed:', id, e.message);
  }

  await db.collection('questions').doc(String(id)).update({
    data: {
      aiAnswer,
      aiAnalysis,
      aiStatus,
      updatedAt: new Date().toISOString()
    }
  });

  return {
    success: aiStatus === 'ready',
    data: { id, aiStatus, aiAnswer, aiAnalysis }
  };
}

async function batchSaveQuestions(event) {
  if (!getCallerOpenId()) return noOpenId();

  const { questions, category, difficulty, imageUrl, generateAi = false } = event;

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return { success: false, error: 'Missing questions array' };
  }

  const baseDifficulty = DIFFICULTY_MAP[difficulty] || 'MEDIUM';

  const prepared = questions
    .map((item) => {
      const text = (item.text || item.content || '').trim();
      if (!text) return null;
      return { item, text };
    })
    .filter(Boolean);

  const saved = await Promise.all(
    prepared.map(async ({ item, text }) => {
      let finalDifficulty = baseDifficulty;
      let tags = [];
      let aiConfidence = item.confidence || 0;

      if (item.type) tags.push(item.type);
      if (item.subject) tags.push(item.subject);

      if (generateAi) {
        const classifyRes = await invokeFunction('classify', {
          action: 'classify',
          text
        });
        if (classifyRes.success && classifyRes.data) {
          tags = Array.from(new Set([...(classifyRes.data.tags || []), ...tags]));
          if (classifyRes.data.difficulty) {
            finalDifficulty = classifyRes.data.difficulty;
          }
          aiConfidence = classifyRes.data.confidence || aiConfidence;
        }
      }

      const createRes = await createQuestion({
        content: text,
        imageUrl: item.imageUrl || imageUrl || '',
        pageFileIDs: Array.isArray(item.pageFileIDs) ? item.pageFileIDs : [],
        pageSpans: Array.isArray(item.pageSpans) ? item.pageSpans : [],
        categoryId: event.categoryId,
        category: category,
        difficulty: finalDifficulty,
        tags,
        aiConfidence,
        aiAnswer: '',
        aiAnalysis: '',
        aiStatus: 'pending',
        ocrConfidence: item.confidence || 0.85,
        skipWorkerNudge: true
      });

      return createRes.success ? createRes.data : null;
    })
  );

  const savedQuestions = saved.filter(Boolean);

  if (savedQuestions.length) {
    nudgeAnswerWorker({ action: 'processPending' });
  }

  return {
    success: true,
    data: {
      savedCount: savedQuestions.length,
      questions: savedQuestions
    }
  };
}
