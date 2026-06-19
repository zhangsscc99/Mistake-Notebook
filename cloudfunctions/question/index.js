const cloud = require('wx-server-sdk');
const https = require('https');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;
const { normalizeQuestion } = require('./normalize');

function mapQuestionList(records) {
  return (records || []).map(normalizeQuestion);
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
  const hasAiContent = !!(aiAnswer || aiAnalysis);
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
    aiStatus: event.aiStatus || (hasAiContent ? 'ready' : ''),
    ocrConfidence: event.ocrConfidence || 0,
    isDeleted: false,
    createdAt: now,
    updatedAt: now
  };

  const result = await db.collection('questions').add({
    data: questionData
  });

  return { success: true, data: normalizeQuestion({ _id: result._id, ...questionData }) };
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

  return { success: true, data: normalizeQuestion(result.data) };
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

  return { success: true, data: mapQuestionList(result.data) };
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
      records: mapQuestionList(result.data),
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

  return { success: true, data: mapQuestionList(result.data) };
}

async function updateQuestion(event) {
  const { id } = event;
  if (!id) {
    return { success: false, error: 'Missing question id' };
  }

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

async function resolveCategory(event) {
  const { categoryId, categoryName } = event;
  if (categoryId) {
    try {
      const result = await db.collection('categories').doc(String(categoryId)).get();
      if (result.data && !result.data.isDeleted) {
        return result.data;
      }
    } catch (e) {
      // fall through
    }
  }

  const name = categoryName || categoryId;
  if (name) {
    const byName = await db.collection('categories')
      .where({ name: String(name), isDeleted: false })
      .limit(1)
      .get();
    if (byName.data.length > 0) {
      return byName.data[0];
    }
  }

  return null;
}

async function getQuestionsByCategory(event) {
  const { categoryId, categoryName } = event;
  if (!categoryId && !categoryName) {
    return { success: false, error: 'Missing categoryId' };
  }

  const category = await resolveCategory({ categoryId, categoryName });
  const settled = _.nin(['pending', 'processing', 'failed']);
  const conditions = [{ categoryId: String(categoryId), isDeleted: false, aiStatus: settled }];

  if (category && category._id) {
    conditions.push({ categoryId: category._id, isDeleted: false, aiStatus: settled });
  }
  if (category && category.name) {
    conditions.push({ category: category.name, isDeleted: false, aiStatus: settled });
  }
  if (categoryName) {
    conditions.push({ category: String(categoryName), isDeleted: false, aiStatus: settled });
  }

  const result = await db.collection('questions')
    .where(_.or(conditions))
    .orderBy('createdAt', 'desc')
    .get();

  return { success: true, data: mapQuestionList(result.data) };
}

async function listPendingQuestions() {
  const result = await db.collection('questions')
    .where({
      isDeleted: false,
      aiStatus: _.in(['pending', 'processing', 'failed'])
    })
    .orderBy('createdAt', 'desc')
    .get();

  return { success: true, data: mapQuestionList(result.data) };
}

async function retryQuestion(event) {
  const { id } = event;
  if (!id) {
    return { success: false, error: 'Missing question id' };
  }

  await db.collection('questions')
    .doc(String(id))
    .update({
      data: {
        aiStatus: 'pending',
        updatedAt: new Date().toISOString()
      }
    });

  return { success: true, data: { _id: id, aiStatus: 'pending' } };
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
  let result = { answer: '', analysis: '', confidence: 0 };
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = { ...result, ...JSON.parse(jsonMatch[0]) };
    }
  } catch (e) {
    console.warn('Failed to parse answer JSON, returning raw text', e.message);
    result.answer = content;
  }
  return result;
}

async function generateAnswersForTexts(texts) {
  const cleaned = (texts || []).map((t) => String(t || '').trim()).filter(Boolean);
  if (!cleaned.length) return [];

  if (cleaned.length === 1) {
    const prompt = `请解答以下题目，给出解题步骤和最终答案。解析控制在 800 字以内。

题目内容：
${cleaned[0]}

请以JSON格式返回（不要包含markdown代码块标记）：
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
  const { id } = event;
  if (!id) {
    return { success: false, error: 'Missing question id' };
  }

  const existing = await db.collection('questions').doc(String(id)).get();
  const doc = existing.data;
  if (!doc || doc.isDeleted) {
    return { success: false, error: 'Question not found' };
  }
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
      let finalCategory = category || item.subject || '';
      let finalDifficulty = baseDifficulty;
      let tags = [];
      let aiConfidence = item.confidence || 0;

      if (item.type) tags.push(item.type);
      if (item.subject && item.subject !== finalCategory) tags.push(item.subject);

      if (generateAi) {
        const classifyRes = await invokeFunction('classify', {
          action: 'classify',
          text
        });
        if (classifyRes.success && classifyRes.data) {
          finalCategory = classifyRes.data.category || finalCategory;
          tags = Array.from(new Set([...(classifyRes.data.tags || []), ...tags]));
          if (classifyRes.data.difficulty) {
            finalDifficulty = classifyRes.data.difficulty;
          }
          aiConfidence = classifyRes.data.confidence || aiConfidence;
        }
      }

      const createRes = await createQuestion({
        content: text,
        imageUrl: imageUrl || '',
        category: finalCategory,
        difficulty: finalDifficulty,
        tags,
        aiConfidence,
        aiAnswer: '',
        aiAnalysis: '',
        aiStatus: 'pending',
        ocrConfidence: item.confidence || 0.85
      });

      return createRes.success ? createRes.data : null;
    })
  );

  const savedQuestions = saved.filter(Boolean);

  return {
    success: true,
    data: {
      savedCount: savedQuestions.length,
      questions: savedQuestions
    }
  };
}
