const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

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
      case 'statsCategory':
        return await statsByCategory();
      case 'statsDifficulty':
        return await statsByDifficulty();
      case 'batchSave':
        return await batchSaveQuestions(event);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

async function createQuestion(event) {
  const { content, imageUrl, category, difficulty, tags, aiAnswer, aiAnalysis } = event;

  let categoryId = event.categoryId;
  if (!categoryId && category) {
    const catResult = await db.collection('categories')
      .where({
        name: category,
        isDeleted: false
      })
      .get();
    if (catResult.data.length > 0) {
      categoryId = catResult.data[0]._id;
    }
  }

  const now = new Date().toISOString();
  const questionData = {
    content: content || '',
    imageUrl: imageUrl || '',
    categoryId: categoryId || '',
    category: category || '',
    difficulty: difficulty || 'MEDIUM',
    tags: tags || [],
    aiConfidence: event.aiConfidence || 0,
    aiAnswer: aiAnswer || '',
    aiAnalysis: aiAnalysis || '',
    ocrConfidence: event.ocrConfidence || 0,
    isDeleted: false,
    createdAt: now,
    updatedAt: now
  };

  const result = await db.collection('questions').add({
    data: questionData
  });

  return { success: true, data: { _id: result._id, ...questionData } };
}

async function getQuestion(event) {
  const { id } = event;
  if (!id) {
    return { success: false, error: 'Missing question id' };
  }

  const result = await db.collection('questions')
    .doc(id)
    .get();

  if (!result.data) {
    return { success: false, error: 'Question not found' };
  }

  return { success: true, data: result.data };
}

async function listQuestions(event) {
  const { category, difficulty, keyword, tag } = event;
  const conditions = { isDeleted: false };

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

  return { success: true, data: result.data };
}

async function pageQuestions(event) {
  const { page = 0, size = 20, category, difficulty, keyword } = event;
  const conditions = { isDeleted: false };

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
      records: result.data,
      total: totalResult.total,
      page,
      size,
      totalPages: Math.ceil(totalResult.total / size)
    }
  };
}

async function batchGetQuestions(event) {
  const { ids } = event;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: 'Missing or invalid ids array' };
  }

  const result = await db.collection('questions')
    .where({
      _id: _.in(ids),
      isDeleted: false
    })
    .get();

  return { success: true, data: result.data };
}

async function updateQuestion(event) {
  const { id } = event;
  if (!id) {
    return { success: false, error: 'Missing question id' };
  }

  const updateFields = {};
  const allowedFields = ['content', 'imageUrl', 'categoryId', 'category', 'difficulty', 'tags', 'aiAnswer', 'aiAnalysis', 'aiConfidence', 'ocrConfidence'];

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
  const { id } = event;
  if (!id) {
    return { success: false, error: 'Missing question id' };
  }

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
  const { ids } = event;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: 'Missing or invalid ids array' };
  }

  const now = new Date().toISOString();

  const updatePromises = ids.map(id =>
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

  return { success: true, data: { deletedCount: ids.length } };
}

async function getQuestionsByCategory(event) {
  const { categoryId } = event;
  if (!categoryId) {
    return { success: false, error: 'Missing categoryId' };
  }

  const result = await db.collection('questions')
    .where({
      categoryId,
      isDeleted: false
    })
    .orderBy('createdAt', 'desc')
    .get();

  return { success: true, data: result.data };
}

async function statsByCategory() {
  const result = await db.collection('questions')
    .aggregate()
    .match({ isDeleted: false })
    .group({
      _id: '$category',
      count: $.sum(1)
    })
    .end();

  return { success: true, data: result.list };
}

async function statsByDifficulty() {
  const result = await db.collection('questions')
    .aggregate()
    .match({ isDeleted: false })
    .group({
      _id: '$difficulty',
      count: $.sum(1)
    })
    .end();

  return { success: true, data: result.list };
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

async function batchSaveQuestions(event) {
  const { questions, category, difficulty, imageUrl } = event;

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return { success: false, error: 'Missing questions array' };
  }

  const saved = [];
  const baseDifficulty = DIFFICULTY_MAP[difficulty] || 'MEDIUM';

  for (const item of questions) {
    const text = (item.text || item.content || '').trim();
    if (!text) continue;

    let finalCategory = category || item.subject || '';
    let finalDifficulty = baseDifficulty;
    let tags = [];
    let aiConfidence = item.confidence || 0;
    let aiAnswer = '';
    let aiAnalysis = '';

    const classifyRes = await invokeFunction('classify', {
      action: 'classify',
      text
    });
    if (classifyRes.success && classifyRes.data) {
      finalCategory = classifyRes.data.category || finalCategory;
      tags = classifyRes.data.tags || [];
      if (classifyRes.data.difficulty) {
        finalDifficulty = classifyRes.data.difficulty;
      }
      aiConfidence = classifyRes.data.confidence || aiConfidence;
    }

    try {
      const answerRes = await invokeFunction('answer', {
        action: 'generate',
        text
      });
      if (answerRes.success && answerRes.data) {
        aiAnswer = answerRes.data.answer || '';
        aiAnalysis = answerRes.data.analysis || '';
        if (answerRes.data.confidence) {
          aiConfidence = Math.max(aiConfidence, answerRes.data.confidence);
        }
      }
    } catch (e) {
      console.warn('Answer generation skipped for one question', e);
    }

    const createRes = await createQuestion({
      content: text,
      imageUrl: imageUrl || '',
      category: finalCategory,
      difficulty: finalDifficulty,
      tags,
      aiConfidence,
      aiAnswer,
      aiAnalysis,
      ocrConfidence: item.confidence || 0.85
    });

    if (createRes.success) {
      saved.push(createRes.data);
    }
  }

  return {
    success: true,
    data: {
      savedCount: saved.length,
      questions: saved
    }
  };
}
