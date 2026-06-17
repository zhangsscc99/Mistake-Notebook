const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

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

const MEMORY_COLLECTION = 'chat_memories';

async function ensureMemoryCollection() {
  try {
    await db.createCollection(MEMORY_COLLECTION);
    return { created: true };
  } catch (e) {
    const msg = e.message || e.errMsg || String(e);
    if (/already exists|已存在|ResourceExist|Duplicate|DATABASE_COLLECTION_ALREADY_EXIST/i.test(msg)) {
      return { created: false, existed: true };
    }
    console.warn('ensureMemoryCollection failed:', msg);
    return { created: false, error: msg };
  }
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
  const memoryCollection = await ensureMemoryCollection();
  const existing = await db.collection('categories').count();
  if (existing.total > 0 && !force) {
    return {
      success: true,
      message: '数据库已初始化，无需重复创建',
      data: { created: 0, total: existing.total, memoryCollection }
    };
  }

  const now = new Date().toISOString();
  let created = 0;

  for (const cat of DEFAULT_CATEGORIES) {
    const found = await db.collection('categories')
      .where({ name: cat.name, isDeleted: false })
      .get();

    if (found.data.length === 0) {
      await db.collection('categories').add({
        data: {
          ...cat,
          isDeleted: false,
          createdAt: now,
          updatedAt: now
        }
      });
      created += 1;
    }
  }

  const total = await db.collection('categories').count();

  return {
    success: true,
    message: `已创建 ${created} 个分类`,
    data: { created, total: total.total, memoryCollection }
  };
}
