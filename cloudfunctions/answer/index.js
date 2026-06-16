const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const https = require('https');

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

const MEMORY_COLLECTION = 'chat_memories';
const MAX_SUMMARY_LEN = 400;
const MAX_TOPICS = 20;

// ─── DashScope helper ────────────────────────────────────────────────────────

function callDashScope(messages, temperature = 0.2) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'qwen-plus',
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
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`Failed to parse DashScope response: ${e.message}, body: ${body}`)); }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Memory helpers ───────────────────────────────────────────────────────────

async function getMemory(db, openid) {
  try {
    const res = await db.collection(MEMORY_COLLECTION)
      .where({ openid })
      .limit(1)
      .get();
    if (res.data && res.data.length > 0) {
      const doc = res.data[0];
      return {
        summary: doc.summary || '',
        topics: Array.isArray(doc.topics) ? doc.topics : [],
        sessionCount: doc.sessionCount || 0
      };
    }
  } catch (e) {
    console.warn('getMemory failed:', e.message);
  }
  return { summary: '', topics: [], sessionCount: 0 };
}

async function upsertMemory(db, openid, summary, topics, sessionCount) {
  const payload = {
    openid,
    summary: String(summary).slice(0, MAX_SUMMARY_LEN),
    topics: (Array.isArray(topics) ? topics : []).slice(0, MAX_TOPICS),
    sessionCount: sessionCount || 0,
    updatedAt: new Date().toISOString()
  };
  try {
    const existing = await db.collection(MEMORY_COLLECTION)
      .where({ openid })
      .limit(1)
      .get();
    if (existing.data && existing.data.length > 0) {
      await db.collection(MEMORY_COLLECTION)
        .doc(existing.data[0]._id)
        .update({ data: payload });
    } else {
      await db.collection(MEMORY_COLLECTION).add({ data: payload });
    }
  } catch (e) {
    console.warn('upsertMemory failed:', e.message);
  }
}

async function extractMemory(oldSummary, messages, questionContext) {
  const recentMsgs = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-12)
    .map(m => `${m.role === 'user' ? '学生' : '老师'}：${m.content}`)
    .join('\n');

  const prompt = `你是一个教育记忆提炼助手。请根据以下信息更新学生的学习档案。

【历史摘要】：${oldSummary || '暂无'}

【本次题目】：${questionContext || '通用答疑'}

【本次对话片段】：
${recentMsgs}

请提炼并返回 JSON（不含 markdown 代码块）：
{
  "summary": "更新后的学生知识薄弱点与学习情况摘要，不超过${MAX_SUMMARY_LEN}字，保留历史关键信息并融入本次新内容",
  "topics": ["知识点1", "知识点2"]
}
topics 为本次涉及的知识点标签，最多5个，简短（2-6字）。`;

  try {
    const resp = await callDashScope(
      [{ role: 'user', content: prompt }],
      0.3
    );
    if (!resp.choices || !resp.choices[0]) return null;
    const raw = resp.choices[0].message.content;
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        summary: parsed.summary || '',
        topics: Array.isArray(parsed.topics) ? parsed.topics : []
      };
    }
  } catch (e) {
    console.warn('extractMemory failed:', e.message);
  }
  return null;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

exports.main = async (event, context) => {
  const { action } = event;

  try {
    switch (action) {
      case 'generate':
        return await generateAnswer(event);
      case 'chat':
        return await chatReply(event, context);
      case 'summarize':
        return await summarizeSession(event, context);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

// ─── Chat with memory injection ───────────────────────────────────────────────

async function chatReply(event, context) {
  const { messages, questionContext } = event;
  const openid = context && context.OPENID;

  if (!Array.isArray(messages) || messages.length === 0) {
    return { success: false, error: 'Missing messages' };
  }

  const db = cloud.database();

  // 1. Load long-term memory
  const memory = openid ? await getMemory(db, openid) : { summary: '', topics: [], sessionCount: 0 };

  // 2. Build system prompt with memory injection
  const memoryBlock = memory.summary
    ? `【学生历史学习记录】：${memory.summary}\n【已涉及知识点】：${memory.topics.join('、') || '暂无'}\n\n`
    : '';

  const contextBlock = questionContext
    ? `【当前题目】：\n${questionContext}\n\n请结合这道题，用清晰、循序渐进的方式解答学生的追问。`
    : '请用清晰、循序渐进的方式回答学生的问题。';

  const systemPrompt = `你是一位耐心、专业的学习辅导老师，正在帮一位学生答疑。
${memoryBlock}${contextBlock}
可以使用分步骤说明，必要时给出关键公式与思路，语言简洁友好，不要使用 markdown 代码块。
如果你在历史记录中发现学生的薄弱点与当前题目相关，请有针对性地加以提示。`;

  const chatMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
      .filter(m => m && m.content && (m.role === 'user' || m.role === 'assistant'))
      .slice(-20)
      .map(m => ({ role: m.role, content: String(m.content) }))
  ];

  const response = await callDashScope(chatMessages, 0.6);

  if (!response.choices || response.choices.length === 0) {
    return { success: false, error: 'Chat failed: ' + JSON.stringify(response) };
  }

  const reply = response.choices[0].message.content;

  // 3. Async memory extraction every 3 user turns (don't block reply)
  const userTurns = messages.filter(m => m.role === 'user').length;
  if (openid && userTurns > 0 && userTurns % 3 === 0) {
    extractMemory(memory.summary, messages, questionContext)
      .then(extracted => {
        if (extracted) {
          const mergedTopics = Array.from(new Set([...memory.topics, ...extracted.topics]));
          upsertMemory(db, openid, extracted.summary, mergedTopics, memory.sessionCount);
        }
      })
      .catch(e => console.warn('async memory extract error:', e.message));
  }

  return { success: true, data: { reply, hasMemory: !!memory.summary } };
}

// ─── Summarize session (called on page unload) ────────────────────────────────

async function summarizeSession(event, context) {
  const { messages, questionContext } = event;
  const openid = context && context.OPENID;

  if (!openid) return { success: false, error: 'No openid' };
  if (!Array.isArray(messages) || messages.length < 2) {
    return { success: true, data: { skipped: true } };
  }

  const db = cloud.database();
  const memory = await getMemory(db, openid);

  const extracted = await extractMemory(memory.summary, messages, questionContext);
  if (extracted) {
    const mergedTopics = Array.from(new Set([...memory.topics, ...extracted.topics]));
    await upsertMemory(db, openid, extracted.summary, mergedTopics, memory.sessionCount + 1);
  }

  return { success: true, data: { updated: !!extracted } };
}

// ─── Generate answer (unchanged) ─────────────────────────────────────────────

async function generateAnswer(event) {
  const { text } = event;

  if (!text) {
    return { success: false, error: 'Missing text' };
  }

  const prompt = `请解答以下题目，给出详细的解题步骤和最终答案。

题目内容：
${text}

请以JSON格式返回（不要包含markdown代码块标记）：
{
  "answer": "最终的答案",
  "analysis": "详细的解题步骤和分析过程",
  "confidence": 0.0-1.0
}`;

  const response = await callDashScope([
    { role: 'user', content: prompt }
  ], 0.2);

  if (!response.choices || response.choices.length === 0) {
    return { success: false, error: 'Answer generation failed: ' + JSON.stringify(response) };
  }

  const content = response.choices[0].message.content;
  let result = { answer: '', analysis: '', confidence: 0 };

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = { ...result, ...JSON.parse(jsonMatch[0]) };
    }
  } catch (e) {
    console.warn('Failed to parse answer JSON, returning raw text', e);
    result.answer = content;
  }

  return { success: true, data: result };
}
