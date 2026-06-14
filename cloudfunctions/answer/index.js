const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const https = require('https');

const DASHSCOPE_API_KEY = 'sk-b2ccb84e15b544bc84e9a8a02cb4e168';
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

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
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse DashScope response: ${e.message}, body: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

exports.main = async (event, context) => {
  const { action } = event;

  try {
    switch (action) {
      case 'generate':
        return await generateAnswer(event);
      case 'chat':
        return await chatReply(event);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

async function chatReply(event) {
  const { messages, questionContext } = event;

  if (!Array.isArray(messages) || messages.length === 0) {
    return { success: false, error: 'Missing messages' };
  }

  const systemPrompt = questionContext
    ? `你是一位耐心、专业的学习辅导老师，正在帮学生答疑。当前讨论的题目是：\n\n${questionContext}\n\n请结合这道题，用清晰、循序渐进的方式解答学生的追问。可以使用分步骤说明，必要时给出关键公式与思路，语言简洁友好，不要使用 markdown 代码块。`
    : '你是一位耐心、专业的学习辅导老师，正在帮学生答疑。请用清晰、循序渐进的方式回答问题，语言简洁友好，不要使用 markdown 代码块。';

  const chatMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
      .filter((m) => m && m.content && (m.role === 'user' || m.role === 'assistant'))
      .slice(-20)
      .map((m) => ({ role: m.role, content: String(m.content) }))
  ];

  const response = await callDashScope(chatMessages, 0.6);

  if (!response.choices || response.choices.length === 0) {
    return { success: false, error: 'Chat failed: ' + JSON.stringify(response) };
  }

  return { success: true, data: { reply: response.choices[0].message.content } };
}

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
