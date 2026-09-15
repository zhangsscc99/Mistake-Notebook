const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;
const { normalizeCategory } = require('./normalize');

const PENDING_STATUSES = ['pending', 'processing', 'failed'];
const settledStatus = () => _.nin(PENDING_STATUSES);
const DEFAULT_CATEGORY_NAMES = [
  '数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '计算机/编程', '政治'
];

function getCallerOpenId() {
  const wxContext = cloud.getWXContext();
  return wxContext.OPENID || wxContext.FROM_OPENID || '';
}

function noOpenId() {
  return { success: false, error: 'NO_OPENID', data: { message: '登录状态异常，请重新登录' } };
}

exports.main = async (event, context) => {
  const { action } = event;

  try {
    switch (action) {
      case 'list':
        return await listCategories();
      case 'get':
        return await getCategory(event);
      case 'stats':
        return await getStats();
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

async function collapseDuplicateCategories(openId) {
  const result = await db.collection('categories')
    .where({ openid: openId })
    .limit(100)
    .get();
  const groups = {};
  (result.data || []).filter((cat) => !cat.isDeleted).forEach((cat) => {
    const key = String(cat.name || '').trim();
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(cat);
  });

  for (const key of Object.keys(groups)) {
    const group = groups[key].slice().sort((a, b) =>
      String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    );
    if (group.length < 2) continue;
    const keep = group[0];
    for (let i = 1; i < group.length; i++) {
      const dup = group[i];
      const questions = await db.collection('questions')
        .where({ openid: openId, categoryId: dup._id, isDeleted: false })
        .limit(100)
        .get();
      await Promise.all((questions.data || []).map((q) =>
        db.collection('questions').doc(q._id).update({
          data: {
            categoryId: keep._id,
            category: keep.name,
            updatedAt: new Date().toISOString()
          }
        })
      ));
      await db.collection('categories').doc(dup._id).update({
        data: { isDeleted: true, updatedAt: new Date().toISOString() }
      });
    }
  }
}

async function moveQuestionsToCategory(openId, fromId, keep) {
  const questions = await db.collection('questions')
    .where({ openid: openId, categoryId: fromId, isDeleted: false })
    .limit(100)
    .get();
  await Promise.all((questions.data || []).map((q) =>
    db.collection('questions').doc(q._id).update({
      data: {
        categoryId: keep._id,
        category: keep.name,
        updatedAt: new Date().toISOString()
      }
    })
  ));
}

async function foldUnofficialCategories(openId) {
  const result = await db.collection('categories')
    .where({ openid: openId })
    .limit(100)
    .get();
  const list = (result.data || []).filter((cat) => !cat.isDeleted);
  const keep = list.find((cat) => cat.name === '数学') || list.find((cat) =>
    DEFAULT_CATEGORY_NAMES.indexOf(String(cat.name || '').trim()) !== -1
  );
  if (!keep) return;
  for (let i = 0; i < list.length; i++) {
    const cat = list[i];
    const name = String(cat.name || '').trim();
    if (DEFAULT_CATEGORY_NAMES.indexOf(name) !== -1) continue;
    await moveQuestionsToCategory(openId, cat._id, keep);
    await db.collection('categories').doc(cat._id).update({
      data: { isDeleted: true, updatedAt: new Date().toISOString() }
    });
  }
}

async function seedPersonalCategories(openId) {
  const now = new Date().toISOString();
  for (const name of DEFAULT_CATEGORY_NAMES) {
    const found = await db.collection('categories')
      .where({ openid: openId, name, isDeleted: false })
      .limit(1)
      .get();
    if (found.data && found.data.length) continue;
    await db.collection('categories').add({
      data: {
        name,
        description: name + '相关题目',
        color: '#4A90E2',
        openid: openId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now
      }
    });
  }
}

function countWhere(openId, extra) {
  return Object.assign({
    openid: openId,
    isDeleted: false,
    aiStatus: settledStatus()
  }, extra);
}

async function countQuestionsInCategory(openId, cat) {
  const countResult = await db.collection('questions')
    .where(_.or([
      countWhere(openId, { categoryId: cat._id }),
      countWhere(openId, { category: cat.name })
    ]))
    .count();
  return countResult.total;
}

async function listCategories() {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  await seedPersonalCategories(openId);
  await collapseDuplicateCategories(openId);
  await foldUnofficialCategories(openId);

  const categoriesResult = await db.collection('categories')
    .where({ openid: openId, isDeleted: false })
    .orderBy('createdAt', 'asc')
    .get();

  const categories = categoriesResult.data;

  const categoriesWithCounts = await Promise.all(categories.map(async (cat) => {
    const questionCount = await countQuestionsInCategory(openId, cat);
    return normalizeCategory({
      ...cat,
      questionCount
    });
  }));

  return { success: true, data: categoriesWithCounts };
}

async function getCategory(event) {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const { id, name } = event;
  if (!id && !name) {
    return { success: false, error: 'Missing category id or name' };
  }

  let category = null;
  if (id) {
    try {
      const result = await db.collection('categories').doc(id).get();
      if (result.data && result.data.openid === openId) {
        category = result.data;
      }
    } catch (e) {
      category = null;
    }
  }

  if (!category && name) {
    const result = await db.collection('categories')
      .where({ openid: openId, name, isDeleted: false })
      .limit(1)
      .get();
    category = result.data[0] || null;
  }

  if (!category || category.isDeleted) {
    return { success: false, error: 'Category not found' };
  }

  const questionCount = await countQuestionsInCategory(openId, category);

  return {
    success: true,
    data: normalizeCategory({
      ...category,
      questionCount
    })
  };
}

async function getStats() {
  const openId = getCallerOpenId();
  if (!openId) return noOpenId();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const totalQuestionsResult = await db.collection('questions')
    .where({ openid: openId, isDeleted: false, aiStatus: settledStatus() })
    .count();

  const totalCategoriesResult = await db.collection('categories')
    .where({ openid: openId, isDeleted: false })
    .count();

  const todayAddedResult = await db.collection('questions')
    .where({
      openid: openId,
      isDeleted: false,
      aiStatus: settledStatus(),
      createdAt: db.command.gte(todayStart.toISOString())
    })
    .count();

  const pendingResult = await db.collection('questions')
    .where({
      openid: openId,
      isDeleted: false,
      aiStatus: _.in(PENDING_STATUSES)
    })
    .count();

  return {
    success: true,
    data: {
      totalQuestions: totalQuestionsResult.total,
      totalCategories: totalCategoriesResult.total,
      todayAdded: todayAddedResult.total,
      pendingCount: pendingResult.total
    }
  };
}
