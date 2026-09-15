const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MEMORY_COLLECTION = 'chat_memories';
// question_marks / checkins / coin_logs / chat_usage 的 _id 全部是确定性拼接
// （见各自云函数），所以不需要事务也不会写重
const COLLECTIONS = [
  'categories',
  'questions',
  'papers',
  MEMORY_COLLECTION,
  'users',
  'question_marks',
  'question_notes',
  'mistake_reports',
  'checkins',
  'coin_logs',
  'chat_usage'
];

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
    return { created: true };
  } catch (e) {
    const msg = e.message || e.errMsg || String(e);
    if (/already exists|已存在|ResourceExist|Duplicate|DATABASE_COLLECTION_ALREADY_EXIST/i.test(msg)) {
      return { created: false, existed: true };
    }
    console.warn(`ensureCollection(${name}) failed:`, msg);
    return { created: false, error: msg };
  }
}

async function ensureMemoryCollection() {
  return ensureCollection(MEMORY_COLLECTION);
}

async function ensureCollections() {
  const results = {};
  for (const name of COLLECTIONS) {
    results[name] = await ensureCollection(name);
  }
  return results;
}

exports.main = async (event) => {
  const { action, force } = event;

  try {
    switch (action) {
      case 'seed':
        return await seedCategories(force);
      case 'ensureMemory':
        return await ensureMemoryCollectionStatus();
      case 'status':
        return await getInitStatus();
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

async function ensureMemoryCollectionStatus() {
  const result = await ensureMemoryCollection();
  return { success: true, data: result };
}

async function getInitStatus() {
  await ensureCollections();
  const categoriesCount = await db.collection('categories').count();
  const questionsCount = await db.collection('questions').count();

  return {
    success: true,
    data: {
      categories: categoriesCount.total,
      questions: questionsCount.total,
      initialized: categoriesCount.total > 0
    }
  };
}

async function seedCategories(force) {
  const collections = await ensureCollections();
  return {
    success: true,
    message: '集合已就绪。默认分类在用户登录时按账号创建',
    data: { created: 0, collections, force: !!force }
  };
}
