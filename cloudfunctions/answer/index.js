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

const USERS_COLLECTION = 'users';
const CHAT_USAGE_COLLECTION = 'chat_usage';
const QUESTIONS_COLLECTION = 'questions';
const REPORTS_COLLECTION = 'mistake_reports';
const LEARNING_REPORTS_COLLECTION = 'learning_reports';
// 错因分析 / 变式题的输入题数上限：防御客户端塞巨数组，也控制 prompt 长度
const MAX_REPORT_QUESTIONS = 20;
const MAX_VARIANT_QUESTIONS = 10;
const MIN_MULTI_QUESTIONS = 1;
const MIN_LEARNING_QUESTIONS = 1;
const LEARNING_SAMPLE_SIZE = 30;
const MIN_VARIANT_QUESTIONS = 1;
// 免费用户每天的对话条数。测试期先给 100，改这一个常量即可调整
const FREE_DAILY_LIMIT = 100;

// ─── 时区 ────────────────────────────────────────────────────────────────────
// 云函数运行时是 UTC。配额的「一天」必须是北京时间的日历日，
// 否则北京时间 0:00–8:00 的对话会被算进前一天。
// （cloudfunctions/user/index.js 里有一份同样的实现，本项目云函数不共享代码，
//   惯例是逐份复制 —— 见 normalize.js 在 category/ 和 question/ 各有一份。）
const CN_OFFSET_MS = 8 * 60 * 60 * 1000;

function cnDayKey(ts) {
  const d = new Date((ts == null ? Date.now() : ts) + CN_OFFSET_MS);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD（北京时间的日历日）
}

function getCallerOpenId(context) {
  const wxContext = cloud.getWXContext();
  return wxContext.OPENID || wxContext.FROM_OPENID || (context && context.OPENID) || '';
}

// ─── 对话配额 ────────────────────────────────────────────────────────────────

async function readChatUsage(db, openid, dayKey) {
  const res = await db.collection(CHAT_USAGE_COLLECTION)
    .where({ openid, dayKey })
    .limit(1)
    .get();
  return ((res.data || [])[0] || {}).count || 0;
}

async function bumpChatUsage(db, openid, dayKey) {
  const _ = db.command;
  const _id = `${openid}_${dayKey}`;
  const now = new Date().toISOString();

  const res = await db.collection(CHAT_USAGE_COLLECTION)
    .doc(_id)
    .update({ data: { count: _.inc(1), updatedAt: now } });

  const updated = (res && res.stats && res.stats.updated) || 0;
  if (updated === 0) {
    // 当天第一条：文档还不存在，update 命中 0 行，得建一份
    try {
      await db.collection(CHAT_USAGE_COLLECTION).add({
        data: { _id, openid, dayKey, count: 1, createdAt: now, updatedAt: now }
      });
    } catch (e) {
      // 两台设备同时发当天第一条会撞 _id，属正常：对方已经建好了，计数也一样对
    }
  }
}

// 会员状态 + 今日用量。会员不计量（remaining 返回 -1 表示不限）
async function resolveQuota(db, openid) {
  const dayKey = cnDayKey();

  const usersRes = await db.collection(USERS_COLLECTION).where({ _id: openid }).limit(1).get();
  const user = (usersRes.data || [])[0] || {};
  const vipExpireAt = user.vipExpireAt || '';
  const isVip = (Date.parse(vipExpireAt) || 0) > Date.now();

  const used = isVip ? 0 : await readChatUsage(db, openid, dayKey);

  return {
    dayKey,
    isVip,
    vipExpireAt,
    limit: FREE_DAILY_LIMIT,
    used,
    remaining: isVip ? -1 : Math.max(0, FREE_DAILY_LIMIT - used),
    allowed: isVip || used < FREE_DAILY_LIMIT
  };
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
      case 'mistakeReport':
        return await generateMistakeReport(event, context);
      case 'listReports':
        return await listMistakeReports(event, context);
      case 'getReport':
        return await getMistakeReport(event, context);
      case 'deleteReport':
        return await deleteMistakeReport(event, context);
      case 'learningOverview':
        return await getLearningOverview(event, context);
      case 'generateLearningReport':
        return await generateLearningReport(event, context);
      case 'listLearningReports':
        return await listLearningReports(event, context);
      case 'getLearningReport':
        return await getLearningReport(event, context);
      case 'deleteLearningReport':
        return await deleteLearningReport(event, context);
      case 'generateVariants':
        return await generateVariants(event, context);
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
  // 顺带把配额和会员状态一起返回：aiChat 页 onLoad 已经在调这个 action，
  // 界面要显示剩余条数就不必再多一次往返
  const quota = await resolveQuota(db, openid);
  return {
    success: true,
    data: {
      hasMemory: hasRecallableMemory(memory),
      memoryLoaded: hasRecallableMemory(memory),
      topics: memory.topics,
      lastQuestions: memory.lastQuestions,
      lastQuestionContext: memory.lastQuestionContext,
      sessionCount: memory.sessionCount,
      memoryError: memory.error,
      quota: {
        isVip: quota.isVip,
        vipExpireAt: quota.vipExpireAt,
        limit: quota.limit,
        used: quota.used,
        remaining: quota.remaining
      }
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

  // 对话从「没有 openid 也能聊」变成必须登录态：配额要有归属才能计量。
  // 小程序内调用一定带 OPENID，只有 tcb fn invoke 命令行没有 —— 那本来就测不了对话
  if (!openid) {
    return {
      success: false,
      error: 'NO_OPENID',
      data: { message: '登录状态异常，请重新进入小程序' }
    };
  }

  const db = cloud.database();

  const quota = await resolveQuota(db, openid);
  if (!quota.allowed) {
    return {
      success: false,
      error: 'QUOTA_EXCEEDED',
      data: {
        used: quota.used,
        limit: quota.limit,
        remaining: 0,
        isVip: false,
        message: `今日免费对话已用完（每天 ${quota.limit} 条），可在「我的」用金币兑换会员`
      }
    };
  }

  // 额度在调用 AI **之前**扣：超额必须在花掉 token 之前拦下。
  // AI 调用失败**不退**额度 —— 否则「反复触发失败的调用」就是一条无限次的免费通道。
  // 代价是一次失败的对话也占一格，100 条/天的额度下无所谓
  if (!quota.isVip) {
    await bumpChatUsage(db, openid, quota.dayKey);
  }

  const memory = await getMemory(db, openid);

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
      memoryError: memory.error || memoryPersist.memoryError,
      // 额度在上面已经扣过一次了，所以展示的剩余量要把这一条算进去
      quota: {
        isVip: quota.isVip,
        limit: quota.limit,
        used: quota.isVip ? 0 : quota.used + 1,
        remaining: quota.isVip ? -1 : Math.max(0, quota.limit - quota.used - 1)
      }
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

// ─── 错因深度分析（1 题或多题 → 报告，保存历史）────────────────────────────
//
// 单题分析这道题本身的错因；多题再归纳共性。报告保存到 mistake_reports
// （按 openid 归属），前端有历史列表可回看。

function truncate(text, maxLen) {
  const s = String(text || '').trim();
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

async function fetchQuestionsByIds(db, ids, maxCount) {
  const questionIds = (Array.isArray(ids) ? ids : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)
    .slice(0, maxCount);

  if (questionIds.length === 0) return [];

  const _ = db.command;
  const res = await db.collection(QUESTIONS_COLLECTION)
    .where({ _id: _.in(questionIds), isDeleted: false })
    .limit(maxCount)
    .get();

  // 保持客户端传入的顺序（数据库 in 查询不保证顺序）
  const byId = {};
  (res.data || []).forEach((doc) => { byId[doc._id] = doc; });
  return questionIds.map((id) => byId[id]).filter(Boolean);
}

function buildQuestionBlock(questions, { withAnalysis = true } = {}) {
  return questions.map((q, i) => {
    const parts = [
      `【第${i + 1}题】（${q.category || '未分类'}，难度：${q.difficulty || '未知'}）`,
      truncate(q.content, 600)
    ];
    if (withAnalysis && q.aiAnalysis) {
      parts.push(`参考解析：${truncate(q.aiAnalysis, 300)}`);
    }
    return parts.join('\n');
  }).join('\n\n');
}

async function generateMistakeReport(event, context) {
  const openid = getCallerOpenId(context);
  if (!openid) {
    return { success: false, error: 'NO_OPENID', data: { message: '登录状态异常，请重新进入小程序' } };
  }

  const db = cloud.database();
  const questions = await fetchQuestionsByIds(db, event.questionIds, MAX_REPORT_QUESTIONS);
  if (questions.length < MIN_MULTI_QUESTIONS) {
    return { success: false, error: `错因分析至少需要 ${MIN_MULTI_QUESTIONS} 道错题` };
  }

  const prompt = questions.length === 1
    ? `你是一位资深学习诊断专家。下面是一位学生的 1 道错题，请做一份针对这道题的「错因分析」，不要只复述解析。

${buildQuestionBlock(questions)}

请严格按以下结构输出（每节用【】开头，不要使用 markdown 代码块，总长度 800 字以内）：
【总体诊断】用 2-3 句话说明这道题暴露的问题。
【错因归类】判断主要错误原因（如：概念不清 / 计算失误 / 审题偏差 / 方法不会 / 知识遗忘等），说明具体表现。
【薄弱知识点】列出需要补强的知识点，按优先级排序。
【改进建议】给出 3-5 条可执行的针对性建议（具体到什么类型的练习、怎么练）。
【攻克顺序】建议接下来先练什么、再练什么，1-2 句话。`
    : `你是一位资深学习诊断专家。下面是一位学生的 ${questions.length} 道错题，请做一份「错因深度分析报告」，找出错题背后的共性问题，而不是逐题复述解析。

${buildQuestionBlock(questions)}

请严格按以下结构输出（每节用【】开头，不要使用 markdown 代码块，总长度 800 字以内）：
【总体诊断】用 2-3 句话概括这批错题反映出的整体学习状况。
【错因归类】把错题按错误原因归类（如：概念不清 / 计算失误 / 审题偏差 / 方法不会 / 知识遗忘等），每类注明涉及哪些题号（如「第1、3题」）并说明具体表现。
【薄弱知识点】列出需要重点补强的知识点，按优先级排序。
【改进建议】给出 3-5 条可执行的针对性建议（具体到什么类型的练习、怎么练）。
【攻克顺序】建议的复习先后顺序及理由，1-2 句话。`;

  const response = await callDashScope([{ role: 'user', content: prompt }], 0.4);
  if (!response.choices || response.choices.length === 0) {
    return { success: false, error: '报告生成失败: ' + JSON.stringify(response) };
  }

  const report = String(response.choices[0].message.content || '').trim();
  if (!report) {
    return { success: false, error: '报告生成失败：内容为空' };
  }

  const now = new Date().toISOString();
  const dayKey = cnDayKey();
  const categories = Array.from(new Set(questions.map((q) => q.category).filter(Boolean)));
  const title = `${dayKey} 错因分析 · ${questions.length}题${categories.length ? '（' + categories.slice(0, 3).join('、') + '）' : ''}`;

  const addRes = await db.collection(REPORTS_COLLECTION).add({
    data: {
      openid,
      title,
      questionIds: questions.map((q) => q._id),
      questionCount: questions.length,
      categories,
      report,
      createdAt: now
    }
  });

  return {
    success: true,
    data: { reportId: addRes._id, title, report, questionCount: questions.length, createdAt: now }
  };
}

async function listMistakeReports(event, context) {
  const openid = getCallerOpenId(context);
  if (!openid) {
    return { success: false, error: 'NO_OPENID' };
  }

  const page = Math.max(0, parseInt(event.page, 10) || 0);
  const size = Math.min(50, Math.max(1, parseInt(event.size, 10) || 20));

  const db = cloud.database();
  const res = await db.collection(REPORTS_COLLECTION)
    .where({ openid })
    .orderBy('createdAt', 'desc')
    .skip(page * size)
    .limit(size)
    .get();

  const list = (res.data || []).map((doc) => ({
    reportId: doc._id,
    title: doc.title || '错因分析报告',
    questionCount: doc.questionCount || (doc.questionIds || []).length,
    categories: doc.categories || [],
    preview: truncate(doc.report, 80),
    createdAt: doc.createdAt || ''
  }));

  return { success: true, data: { list, page, size } };
}

async function getMistakeReport(event, context) {
  const openid = getCallerOpenId(context);
  const reportId = String(event.reportId || '').trim();
  if (!openid || !reportId) {
    return { success: false, error: 'Missing reportId or openid' };
  }

  const db = cloud.database();
  const res = await db.collection(REPORTS_COLLECTION).doc(reportId).get();
  const doc = res.data;
  if (!doc || doc.openid !== openid) {
    return { success: false, error: 'Report not found' };
  }

  return {
    success: true,
    data: {
      reportId: doc._id,
      title: doc.title || '错因分析报告',
      questionCount: doc.questionCount || 0,
      categories: doc.categories || [],
      report: doc.report || '',
      createdAt: doc.createdAt || ''
    }
  };
}

async function deleteMistakeReport(event, context) {
  const openid = getCallerOpenId(context);
  const reportId = String(event.reportId || '').trim();
  if (!openid || !reportId) {
    return { success: false, error: 'Missing reportId or openid' };
  }

  const db = cloud.database();
  const res = await db.collection(REPORTS_COLLECTION).doc(reportId).get();
  if (!res.data || res.data.openid !== openid) {
    return { success: false, error: 'Report not found' };
  }

  await db.collection(REPORTS_COLLECTION).doc(reportId).remove();
  return { success: true, data: { reportId } };
}

// ─── 个性化学习报告（整本错题本总体数据 → 报告，保存历史）────────────────
//
// 和错因分析分开：错因是用户勾选的那几道题，这份是账号里的全部统计
// + 最近一批题抽样。用户点「生成一份」才调模型，进页只读总览。

function normalizeDifficulty(d) {
  const s = String(d || '').toUpperCase();
  if (s === 'EASY' || s === '简单') return 'EASY';
  if (s === 'HARD' || s === '困难' || s === '较难') return 'HARD';
  return 'MEDIUM';
}

async function safeCount(promise) {
  try {
    const res = await promise;
    return (res && res.total) || 0;
  } catch (e) {
    return 0;
  }
}

async function ensureLearningReportsCollection(db) {
  try {
    await db.createCollection(LEARNING_REPORTS_COLLECTION);
  } catch (e) {
    // 已存在或没权限建集合都继续：真正写入失败时再把错误抛给前端
  }
}

async function buildLearningOverview(db, openid) {
  const $ = db.command.aggregate;

  const [
    questionCount,
    favoriteCount,
    pinnedCount,
    masteredCount,
    noteCount,
    paperCount,
    userRes,
    catAgg,
    diffAgg
  ] = await Promise.all([
    safeCount(db.collection(QUESTIONS_COLLECTION).where({ openid, isDeleted: false }).count()),
    safeCount(db.collection('question_marks').where({ openid, favorite: true }).count()),
    safeCount(db.collection('question_marks').where({ openid, pinned: true }).count()),
    safeCount(db.collection('question_marks').where({ openid, mastered: true }).count()),
    safeCount(db.collection('question_notes').where({ openid }).count()),
    safeCount(db.collection('papers').where({ openId: openid, isDeleted: false }).count()),
    db.collection(USERS_COLLECTION).where({ _id: openid }).limit(1).get().catch(() => ({ data: [] })),
    db.collection(QUESTIONS_COLLECTION).aggregate()
      .match({ openid, isDeleted: false })
      .group({ _id: '$category', count: $.sum(1) })
      .end()
      .catch(() => ({ list: [] })),
    db.collection(QUESTIONS_COLLECTION).aggregate()
      .match({ openid, isDeleted: false })
      .group({ _id: '$difficulty', count: $.sum(1) })
      .end()
      .catch(() => ({ list: [] }))
  ]);

  const user = ((userRes.data || [])[0]) || {};
  const categories = (catAgg.list || [])
    .map((row) => ({ name: row._id || '未分类', count: row.count || 0 }))
    .sort((a, b) => b.count - a.count);

  const difficulties = { EASY: 0, MEDIUM: 0, HARD: 0 };
  (diffAgg.list || []).forEach((row) => {
    const key = normalizeDifficulty(row._id);
    difficulties[key] += row.count || 0;
  });

  return {
    questionCount,
    categoryCount: categories.length,
    categories,
    difficulties,
    masteredCount,
    favoriteCount,
    pinnedCount,
    noteCount,
    paperCount,
    checkinStreak: user.checkinStreak || 0,
    checkinTotalDays: user.checkinTotalDays || 0,
    stage: user.stage || '',
    nickName: user.nickName || '',
    canGenerate: questionCount >= MIN_LEARNING_QUESTIONS,
    minQuestions: MIN_LEARNING_QUESTIONS
  };
}

async function fetchRecentQuestions(db, openid) {
  try {
    const res = await db.collection(QUESTIONS_COLLECTION)
      .where({ openid, isDeleted: false })
      .orderBy('createdAt', 'desc')
      .limit(LEARNING_SAMPLE_SIZE)
      .get();
    return res.data || [];
  } catch (e) {
    const res = await db.collection(QUESTIONS_COLLECTION)
      .where({ openid, isDeleted: false })
      .limit(LEARNING_SAMPLE_SIZE)
      .get();
    return res.data || [];
  }
}

function formatOverviewForPrompt(overview, samples) {
  const catLine = overview.categories.map((c) => `${c.name} ${c.count}道`).join('、') || '无';
  const d = overview.difficulties || {};
  return `学生画像：
昵称：${overview.nickName || '未设置'}
学段：${overview.stage || '未设置'}
错题总数：${overview.questionCount}
分类分布：${catLine}
难度：简单 ${d.EASY || 0}、中等 ${d.MEDIUM || 0}、较难 ${d.HARD || 0}
已掌握标记：${overview.masteredCount}
收藏 ${overview.favoriteCount}、置顶 ${overview.pinnedCount}
笔记 ${overview.noteCount} 条、组卷 ${overview.paperCount} 份
连续打卡 ${overview.checkinStreak} 天、累计 ${overview.checkinTotalDays} 天

最近收录的错题抽样（共 ${samples.length} 道，只用来判断薄弱点，不要逐题讲解）：
${buildQuestionBlock(samples, { withAnalysis: false })}`;
}

async function getLearningOverview(event, context) {
  const openid = getCallerOpenId(context);
  if (!openid) {
    return { success: false, error: 'NO_OPENID', data: { message: '登录状态异常，请重新进入小程序' } };
  }
  const db = cloud.database();
  const overview = await buildLearningOverview(db, openid);
  return { success: true, data: overview };
}

async function generateLearningReport(event, context) {
  const openid = getCallerOpenId(context);
  if (!openid) {
    return { success: false, error: 'NO_OPENID', data: { message: '登录状态异常，请重新进入小程序' } };
  }

  const db = cloud.database();
  await ensureLearningReportsCollection(db);

  const overview = await buildLearningOverview(db, openid);
  if (!overview.canGenerate) {
    return { success: false, error: `至少收录 ${MIN_LEARNING_QUESTIONS} 道错题后再生成学习报告` };
  }

  const samples = await fetchRecentQuestions(db, openid);
  const prompt = `你是一位资深学习规划老师。请根据这位学生「整本错题本」的总体数据，写一份个性化学习报告。不要做成单题解析，也不要复述错因分析报告。

${formatOverviewForPrompt(overview, samples)}

请严格按以下结构输出（每节用【】开头，不要使用 markdown 代码块，总长度 900 字以内）：
【学习总评】2-3 句话概括当前学习状态。
【学科与分类】指出错题集中在哪些分类，可能的原因。
【难度与掌握】结合难度分布和已掌握数量，判断挑战是否合适。
【学习习惯】结合打卡、组卷、笔记给出习惯评价。
【薄弱点】列出 3 个最该优先补的方向。
【接下来 7 天】给出可执行的 7 天计划，具体到每天做什么类型的练习。`;

  const response = await callDashScope([{ role: 'user', content: prompt }], 0.4);
  if (!response.choices || response.choices.length === 0) {
    return { success: false, error: '报告生成失败: ' + JSON.stringify(response) };
  }

  const report = String(response.choices[0].message.content || '').trim();
  if (!report) {
    return { success: false, error: '报告生成失败：内容为空' };
  }

  const now = new Date().toISOString();
  const dayKey = cnDayKey();
  const topCats = overview.categories.slice(0, 3).map((c) => c.name).filter(Boolean);
  const title = `${dayKey} 学习报告 · ${overview.questionCount}题${topCats.length ? '（' + topCats.join('、') + '）' : ''}`;

  const addRes = await db.collection(LEARNING_REPORTS_COLLECTION).add({
    data: {
      openid,
      title,
      report,
      questionCount: overview.questionCount,
      categories: overview.categories.map((c) => c.name),
      overview,
      createdAt: now
    }
  });

  return {
    success: true,
    data: {
      reportId: addRes._id,
      title,
      report,
      questionCount: overview.questionCount,
      categories: overview.categories.map((c) => c.name),
      createdAt: now
    }
  };
}

async function listLearningReports(event, context) {
  const openid = getCallerOpenId(context);
  if (!openid) {
    return { success: false, error: 'NO_OPENID' };
  }

  const page = Math.max(0, parseInt(event.page, 10) || 0);
  const size = Math.min(50, Math.max(1, parseInt(event.size, 10) || 20));
  const db = cloud.database();
  await ensureLearningReportsCollection(db);

  let res;
  try {
    res = await db.collection(LEARNING_REPORTS_COLLECTION)
      .where({ openid })
      .orderBy('createdAt', 'desc')
      .skip(page * size)
      .limit(size)
      .get();
  } catch (e) {
    return { success: true, data: { list: [], page, size } };
  }

  const list = (res.data || []).map((doc) => ({
    reportId: doc._id,
    title: doc.title || '学习报告',
    questionCount: doc.questionCount || 0,
    categories: doc.categories || [],
    preview: truncate(doc.report, 80),
    createdAt: doc.createdAt || ''
  }));

  return { success: true, data: { list, page, size } };
}

async function getLearningReport(event, context) {
  const openid = getCallerOpenId(context);
  const reportId = String(event.reportId || '').trim();
  if (!openid || !reportId) {
    return { success: false, error: 'Missing reportId or openid' };
  }

  const db = cloud.database();
  const res = await db.collection(LEARNING_REPORTS_COLLECTION).doc(reportId).get();
  const doc = res.data;
  if (!doc || doc.openid !== openid) {
    return { success: false, error: 'Report not found' };
  }

  return {
    success: true,
    data: {
      reportId: doc._id,
      title: doc.title || '学习报告',
      questionCount: doc.questionCount || 0,
      categories: doc.categories || [],
      report: doc.report || '',
      createdAt: doc.createdAt || ''
    }
  };
}

async function deleteLearningReport(event, context) {
  const openid = getCallerOpenId(context);
  const reportId = String(event.reportId || '').trim();
  if (!openid || !reportId) {
    return { success: false, error: 'Missing reportId or openid' };
  }

  const db = cloud.database();
  const res = await db.collection(LEARNING_REPORTS_COLLECTION).doc(reportId).get();
  if (!res.data || res.data.openid !== openid) {
    return { success: false, error: 'Report not found' };
  }

  await db.collection(LEARNING_REPORTS_COLLECTION).doc(reportId).remove();
  return { success: true, data: { reportId } };
}

// ─── 变式题生成（1 道或多道 → 变式题，前端挑选后入库）────────────────────────
//
// 单题即可改编；多题则对准共性考点。只生成不入库 —— 学生勾选确认后
// 由 question 云函数的 saveVariants 入库，避免质量不佳的题污染题库。

async function generateVariants(event, context) {
  const openid = getCallerOpenId(context);
  if (!openid) {
    return { success: false, error: 'NO_OPENID', data: { message: '登录状态异常，请重新进入小程序' } };
  }

  const db = cloud.database();
  const questions = await fetchQuestionsByIds(db, event.questionIds, MAX_VARIANT_QUESTIONS);
  if (questions.length < MIN_VARIANT_QUESTIONS) {
    return { success: false, error: '请选择至少 1 道错题' };
  }

  const prompt = `你是一位命题专家。下面是一位学生的 ${questions.length} 道错题，请基于考查的知识点出 3 道「变式题」帮助学生针对性巩固。

${buildQuestionBlock(questions, { withAnalysis: false })}

要求：
1. 变式题要与原题考点相同但情境、数字或设问方式不同，不能只改几个字；
2. 3 道题难度递进（第1道比原题略易，第2道相当，第3道略难）；
3. 每道题都要能独立成立、表述清晰、有确定答案。

只返回一个纯 JSON 数组，不要输出任何解释文字，不要使用 markdown 代码块。JSON 字符串内部的换行用 \\n，确保整体可被 JSON.parse 解析。格式：
[
  {
    "content": "变式题题干",
    "answer": "最终答案",
    "analysis": "解题步骤与解析（300字以内）",
    "difficulty": "EASY 或 MEDIUM 或 HARD",
    "knowledgePoint": "考查的知识点（2-8字）"
  }
]`;

  const response = await callDashScope([{ role: 'user', content: prompt }], 0.5);
  if (!response.choices || response.choices.length === 0) {
    return { success: false, error: '变式题生成失败: ' + JSON.stringify(response) };
  }

  const raw = String(response.choices[0].message.content || '');
  let variants = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        variants = parsed
          .map((v) => ({
            content: String(v.content || '').trim(),
            answer: String(v.answer || '').trim(),
            analysis: String(v.analysis || '').trim(),
            difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(String(v.difficulty || '').toUpperCase())
              ? String(v.difficulty).toUpperCase() : 'MEDIUM',
            knowledgePoint: String(v.knowledgePoint || '').trim().slice(0, 20)
          }))
          .filter((v) => v.content && v.answer);
      }
    }
  } catch (e) {
    console.warn('generateVariants parse failed:', e.message);
  }

  if (variants.length === 0) {
    return { success: false, error: '变式题生成失败：无法解析结果，请重试' };
  }

  return {
    success: true,
    data: {
      variants,
      sourceQuestionIds: questions.map((q) => q._id),
      categories: Array.from(new Set(questions.map((q) => q.category).filter(Boolean)))
    }
  };
}
