const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const $ = db.command.aggregate;

exports.main = async (event, context) => {
  const { action } = event;

  try {
    switch (action) {
      case 'list':
        return await listCategories();
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
    return {
      ...cat,
      questionCount: countResult.total
    };
  }));

  return { success: true, data: categoriesWithCounts };
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
