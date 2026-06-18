const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DASHSCOPE_MODEL = 'qwen3-vl-flash';
const PENDING_BATCH_SIZE = 2;

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

async function generateAnswerText(text) {
  const prompt = `请解答以下题目，给出详细的解题步骤和最终答案。

题目内容：
${text}

请以JSON格式返回（不要包含markdown代码块标记）：
{
  "answer": "最终的答案",
  "analysis": "详细的解题步骤和分析过程",
  "confidence": 0.0-1.0
}`;

  const response = await callDashScope([{ role: 'user', content: prompt }], 0.2);
  if (!response.choices || response.choices.length === 0) {
    throw new Error('Answer generation failed: ' + JSON.stringify(response).slice(0, 200));
  }

  const content = response.choices[0].message.content;
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

function resolveDocId(event) {
  return event.docId || event.id || (event.data && event.data.docId) || '';
}

function isInsertEvent(event) {
  const type = event.type || event.dataType || '';
  if (!type) return !!event.docId || !!event.id;
  return type === 'insert' || type === 'add';
}

function isTimerEvent(event, context) {
  if (event.action === 'processPending') return true;
  try {
    const wxContext = cloud.getWXContext();
    if (wxContext.SOURCE === 'wx_trigger') return true;
  } catch (e) {
    // ignore
  }
  if (context && context.triggerName) return true;
  return event.TriggerName || event.Type === 'Timer' || event.type === 'timer';
}

async function loadQuestion(docId, eventDoc) {
  if (eventDoc && (eventDoc.content || eventDoc._id)) {
    return { _id: docId || eventDoc._id, ...eventDoc };
  }
  try {
    const result = await db.collection('questions').doc(String(docId)).get();
    return result.data || null;
  } catch (e) {
    console.warn('loadQuestion failed:', docId, e.message);
    return null;
  }
}

async function generateForQuestion(docId, doc) {
  if (!docId) {
    return { success: false, error: 'Missing docId' };
  }

  const text = (doc && doc.content || '').trim();
  if (!text) {
    return { success: false, error: 'Missing question content' };
  }

  if (doc.aiStatus === 'ready' && doc.aiAnalysis) {
    console.log('answerWorker skip:', docId, 'already_ready');
    return { success: true, data: { skipped: true, reason: 'already_ready' } };
  }
  if (doc.aiStatus === 'processing') {
    const updatedAt = doc.updatedAt ? Date.parse(doc.updatedAt) : 0;
    if (updatedAt && Date.now() - updatedAt < 3 * 60 * 1000) {
      console.log('answerWorker skip:', docId, 'processing');
      return { success: true, data: { skipped: true, reason: 'processing' } };
    }
  }
  if (doc.aiAnswer || doc.aiAnalysis) {
    console.log('answerWorker skip:', docId, 'has_ai_content');
    return { success: true, data: { skipped: true, reason: 'has_ai_content' } };
  }

  console.log('answerWorker generating:', docId, 'status=', doc.aiStatus);
  const now = new Date().toISOString();
  await db.collection('questions').doc(String(docId)).update({
    data: { aiStatus: 'processing', updatedAt: now }
  });

  try {
    const answerData = await generateAnswerText(text);
    await db.collection('questions').doc(String(docId)).update({
      data: {
        aiAnswer: answerData.answer || '',
        aiAnalysis: answerData.analysis || '',
        aiStatus: 'ready',
        updatedAt: new Date().toISOString()
      }
    });
    console.log('answerWorker ready:', docId);
    return { success: true, data: { updated: true } };
  } catch (e) {
    console.warn('answerWorker generate failed:', docId, e.message);
  }

  await db.collection('questions').doc(String(docId)).update({
    data: { aiStatus: 'failed', updatedAt: new Date().toISOString() }
  });
  return { success: false, error: 'Answer generation failed' };
}

async function processPendingBatch() {
  const staleBefore = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const pendingRes = await db.collection('questions')
    .where({
      isDeleted: false,
      aiStatus: _.in(['pending', 'failed'])
    })
    .orderBy('createdAt', 'asc')
    .limit(PENDING_BATCH_SIZE)
    .get();

  let docs = pendingRes.data || [];
  if (docs.length < PENDING_BATCH_SIZE) {
    const staleRes = await db.collection('questions')
      .where({
        isDeleted: false,
        aiStatus: 'processing',
        updatedAt: _.lt(staleBefore)
      })
      .orderBy('updatedAt', 'asc')
      .limit(PENDING_BATCH_SIZE - docs.length)
      .get();
    docs = docs.concat(staleRes.data || []);
  }

  console.log('answerWorker processPending:', docs.length, 'questions');

  if (!docs.length) {
    return { success: true, data: { processed: 0, results: [] } };
  }

  const results = [];
  for (const doc of docs) {
    results.push({
      id: doc._id,
      result: await generateForQuestion(doc._id, doc)
    });
  }

  return { success: true, data: { processed: results.length, results } };
}

exports.main = async (event, context) => {
  console.log('answerWorker event:', JSON.stringify({
    action: event.action,
    type: event.type || event.dataType,
    docId: event.docId || event.id,
    hasDoc: !!event.doc,
    source: (() => {
      try { return cloud.getWXContext().SOURCE; } catch (e) { return ''; }
    })()
  }));

  if (isTimerEvent(event, context)) {
    return processPendingBatch();
  }

  const docId = resolveDocId(event);
  const eventDoc = event.doc || (event.data && event.data.doc) || null;

  if (event.action === 'generate' && docId) {
    const doc = await loadQuestion(docId, eventDoc);
    if (!doc) {
      return { success: false, error: 'Question not found' };
    }
    return generateForQuestion(docId, doc);
  }

  if (!isInsertEvent(event)) {
    console.log('answerWorker skip: not_insert');
    return { success: true, data: { skipped: true, reason: 'not_insert' } };
  }

  if (!docId) {
    return { success: false, error: 'Missing docId from trigger event' };
  }

  const doc = await loadQuestion(docId, eventDoc);
  if (!doc) {
    return { success: false, error: 'Question not found' };
  }

  if (doc.isDeleted) {
    return { success: true, data: { skipped: true, reason: 'deleted' } };
  }
  if (doc.aiStatus !== 'pending') {
    console.log('answerWorker skip:', docId, 'not_pending', doc.aiStatus);
    return { success: true, data: { skipped: true, reason: 'not_pending' } };
  }

  return generateForQuestion(docId, doc);
};
