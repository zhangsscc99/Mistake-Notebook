const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const $ = db.command.aggregate;
const { normalizeCategory } = require('./normalize');

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

async function listCategories() {
  const categoriesResult = await db.collection('categories')
    .where({ isDeleted: false })
    .orderBy('createdAt', 'asc')
    .get();

  const categories = categoriesResult.data;

  const categoriesWithCounts = await Promise.all(categories.map(async (cat) => {
    const countResult = await db.collection('questions')
      .where({
        categoryId: cat._id,
        isDeleted: false
      })
      .count();
    return normalizeCategory({
      ...cat,
      questionCount: countResult.total
    });
  }));

  return { success: true, data: categoriesWithCounts };
}

async function getCategory(event) {
  const { id, name } = event;
  if (!id && !name) {
    return { success: false, error: 'Missing category id or name' };
  }

  let category = null;
  if (id) {
    try {
      const result = await db.collection('categories').doc(id).get();
      category = result.data;
    } catch (e) {
      category = null;
    }
  }

  if (!category && name) {
    const result = await db.collection('categories')
      .where({ name, isDeleted: false })
      .limit(1)
      .get();
    category = result.data[0] || null;
  }

  if (!category || category.isDeleted) {
    return { success: false, error: 'Category not found' };
  }

  const countResult = await db.collection('questions')
    .where({ categoryId: category._id, isDeleted: false })
    .count();

  return {
    success: true,
    data: normalizeCategory({
      ...category,
      questionCount: countResult.total
    })
  };
}

async function getStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const totalQuestionsResult = await db.collection('questions')
    .where({ isDeleted: false })
    .count();

  const totalCategoriesResult = await db.collection('categories')
    .where({ isDeleted: false })
    .count();

  const todayAddedResult = await db.collection('questions')
    .where({
      isDeleted: false,
      createdAt: db.command.gte(todayStart.toISOString())
    })
    .count();

  return {
    success: true,
    data: {
      totalQuestions: totalQuestionsResult.total,
      totalCategories: totalCategoriesResult.total,
      todayAdded: todayAddedResult.total
    }
  };
}
