const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const https = require('https');

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

const MEMORY_COLLECTION = 'chat_memories';
const MAX_SUMMARY_LEN = 400;
const MAX_TOPICS = 20;
const MAX_LAST_QUESTIONS = 5;
const MAX_QUESTION_LEN = 150;
const MAX_CONTEXT_LEN = 300;
const MAX_RECENT_SESSIONS = 3;

function getCallerOpenId(context) {
  const wxContext = cloud.getWXContext();
  return wxContext.OPENID || wxContext.FROM_OPENID || (context && context.OPENID) || '';
}

// ─── DashScope helper ────────────────────────────────────────────────────────

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

function collectUserQuestions(messages, limit = MAX_LAST_QUESTIONS, maxLen = MAX_QUESTION_LEN) {
  return (messages || [])
    .filter((m) => m.role === 'user' && m.content)
    .map((m) => String(m.content).trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(-limit);
}

function truncateContext(text, maxLen = MAX_CONTEXT_LEN) {
  if (!text) return '';
  const trimmed = String(text).trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) + '…' : trimmed;
}

function normalizeMemory(doc) {
  if (!doc) {
    return {
      summary: '',
      topics: [],
      lastQuestions: [],
      lastQuestionContext: '',
      recentSessions: [],
      sessionCount: 0,
      error: null
    };
  }
  return {
    summary: doc.summary || '',
    topics: Array.isArray(doc.topics) ? doc.topics : [],
    lastQuestions: Array.isArray(doc.lastQuestions) ? doc.lastQuestions : [],
    lastQuestionContext: doc.lastQuestionContext || '',
    recentSessions: Array.isArray(doc.recentSessions) ? doc.recentSessions : [],
    sessionCount: doc.sessionCount || 0,
    error: null
  };
}

function hasRecallableMemory(memory) {
  return !!(
    memory.summary
    || (memory.lastQuestions && memory.lastQuestions.length > 0)
    || memory.lastQuestionContext
  );
}

function buildRecentSessionSnapshot(messages, questionContext) {
  return {
    at: new Date().toISOString(),
    questionContext: truncateContext(questionContext),
    questions: collectUserQuestions(messages)
  };
}

function mergeRecentSessions(existing, snapshot) {
  const sessions = Array.isArray(existing) ? [...existing] : [];
  if (snapshot && snapshot.questions && snapshot.questions.length > 0) {
    sessions.push(snapshot);
  }
  return sessions.slice(-MAX_RECENT_SESSIONS);
}

async function getMemory(db, openid) {
  try {
    const res = await db.collection(MEMORY_COLLECTION)
      .where({ openid })
      .limit(1)
      .get();
    if (res.data && res.data.length > 0) {
      return normalizeMemory(res.data[0]);
    }
    return normalizeMemory(null);
  } catch (e) {
    console.warn('getMemory failed:', e.message);
    return { ...normalizeMemory(null), error: e.message };
  }
}

async function upsertMemory(db, openid, memoryData) {
  const payload = {
    openid,
    summary: String(memoryData.summary || '').slice(0, MAX_SUMMARY_LEN),
    topics: (Array.isArray(memoryData.topics) ? memoryData.topics : []).slice(0, MAX_TOPICS),
    lastQuestions: (Array.isArray(memoryData.lastQuestions) ? memoryData.lastQuestions : [])
      .slice(-MAX_LAST_QUESTIONS),
    lastQuestionContext: truncateContext(memoryData.lastQuestionContext || ''),
    recentSessions: (Array.isArray(memoryData.recentSessions) ? memoryData.recentSessions : [])
      .slice(-MAX_RECENT_SESSIONS),
    sessionCount: memoryData.sessionCount || 0,
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
    return { ok: true, error: null };
  } catch (e) {
    console.warn('upsertMemory failed:', e.message);
    return { ok: false, error: e.message };
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

function buildMemoryInstruction(memory) {
  const hasRecall = hasRecallableMemory(memory);
  if (hasRecall) {
    return `你拥有该学生的跨会话学习档案（见下方各段记录）。当学生询问「上次问了什么」「记得吗」「我们之前聊过什么」时，必须优先引用【历史上问过的问题（原文）】中的原话作答；若该段为空，再参考学习情况摘要。不要编造未出现在档案中的问题，不要声称「没有记忆功能」或「无法回溯对话」。
`;
  }
  return `该学生暂无历史学习档案（可能是首次使用或档案尚未生成）。当学生询问你是否记得之前聊过什么时，可说明当前还没有可引用的历史档案，但不要声称系统本身不具备跨会话记忆能力。
`;
}

function buildMemoryBlock(memory) {
  if (!hasRecallableMemory(memory)) return '';

  const parts = [];

  if (memory.lastQuestions && memory.lastQuestions.length > 0) {
    const numbered = memory.lastQuestions
      .map((q, i) => `${i + 1}. ${q}`)
      .join('\n');
    parts.push(`【历史上问过的问题（原文，按时间从旧到新）】：\n${numbered}`);
  }

  if (memory.lastQuestionContext) {
    parts.push(`【最近一次答疑的题目背景】：\n${memory.lastQuestionContext}`);
  }

  if (memory.summary) {
    parts.push(`【学习情况摘要】：${memory.summary}`);
  }

  if (memory.topics && memory.topics.length > 0) {
    parts.push(`【已涉及知识点】：${memory.topics.join('、')}`);
  }

  return parts.join('\n\n') + '\n\n';
}

async function persistMemoryFromMessages(db, openid, memory, messages, questionContext, incrementSession) {
  const sessionQuestions = collectUserQuestions(messages);
  const sessionContext = truncateContext(questionContext);
  const sessionSnapshot = buildRecentSessionSnapshot(messages, questionContext);

  const extracted = await extractMemory(memory.summary, messages, questionContext);

  const mergedTopics = extracted
    ? Array.from(new Set([...memory.topics, ...extracted.topics]))
    : memory.topics;

  const sessionCount = incrementSession
    ? (memory.sessionCount || 0) + 1
    : (memory.sessionCount || 0);

  const memoryData = {
    summary: extracted ? extracted.summary : memory.summary,
    topics: mergedTopics,
    lastQuestions: sessionQuestions.length > 0 ? sessionQuestions : memory.lastQuestions,
    lastQuestionContext: sessionContext || memory.lastQuestionContext,
    recentSessions: mergeRecentSessions(memory.recentSessions, sessionSnapshot),
    sessionCount
  };

  const writeResult = await upsertMemory(db, openid, memoryData);
  return {
    updated: writeResult.ok,
    memoryError: writeResult.error,
    lastQuestions: memoryData.lastQuestions
  };
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
      case 'getMemoryStatus':
        return await getMemoryStatus(event, context);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

// ─── Memory status (for greeting / debug) ───────────────────────────────────

async function getMemoryStatus(event, context) {
  const openid = getCallerOpenId(context);
  if (!openid) {
    return { success: false, error: 'No openid' };
  }
  const db = cloud.database();
  const memory = await getMemory(db, openid);
  return {
    success: true,
    data: {
      hasMemory: hasRecallableMemory(memory),
      memoryLoaded: hasRecallableMemory(memory),
      topics: memory.topics,
      lastQuestions: memory.lastQuestions,
      lastQuestionContext: memory.lastQuestionContext,
      sessionCount: memory.sessionCount,
      memoryError: memory.error
    }
  };
}

// ─── Chat with memory injection ───────────────────────────────────────────────

async function chatReply(event, context) {
  const { messages, questionContext } = event;
  const openid = getCallerOpenId(context);

  if (!Array.isArray(messages) || messages.length === 0) {
    return { success: false, error: 'Missing messages' };
  }

  const db = cloud.database();

  const memory = openid
    ? await getMemory(db, openid)
    : normalizeMemory(null);

  const memoryBlock = buildMemoryBlock(memory);

  const contextBlock = questionContext
    ? `【当前题目】：\n${questionContext}\n\n请结合这道题，用清晰、循序渐进的方式解答学生的追问。`
    : '请用清晰、循序渐进的方式回答学生的问题。';

  const systemPrompt = `你是一位耐心、专业的学习辅导老师，正在帮一位学生答疑。
${buildMemoryInstruction(memory)}${memoryBlock}${contextBlock}
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

  let memoryPersist = { updated: false, memoryError: null };
  const userTurns = messages.filter(m => m.role === 'user').length;
  if (openid && userTurns > 0 && userTurns % 3 === 0) {
    memoryPersist = await persistMemoryFromMessages(
      db, openid, memory, messages, questionContext, false
    );
  }

  return {
    success: true,
    data: {
      reply,
      hasMemory: hasRecallableMemory(memory),
      memoryLoaded: hasRecallableMemory(memory),
      topics: memory.topics,
      lastQuestions: memory.lastQuestions,
      memoryError: memory.error || memoryPersist.memoryError
    }
  };
}

// ─── Summarize session (called on page hide/unload) ───────────────────────────

async function summarizeSession(event, context) {
  const { messages, questionContext } = event;
  const openid = getCallerOpenId(context);

  if (!openid) return { success: false, error: 'No openid' };

  const userMsgs = (messages || []).filter((m) => m.role === 'user' && m.content);
  if (userMsgs.length === 0) {
    return { success: true, data: { skipped: true } };
  }

  const db = cloud.database();
  const memory = await getMemory(db, openid);
  const persistResult = await persistMemoryFromMessages(
    db, openid, memory, messages, questionContext, true
  );

  return {
    success: true,
    data: {
      updated: persistResult.updated,
      memoryError: memory.error || persistResult.memoryError
    }
  };
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
