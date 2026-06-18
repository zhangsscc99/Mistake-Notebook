const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const https = require('https');

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
      case 'classify':
        return await classifyText(event);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

async function classifyText(event) {
  const { text } = event;

  if (!text) {
    return { success: false, error: 'Missing text' };
  }

  const prompt = `请对以下题目进行分类。返回JSON格式（不要包含markdown代码块标记）：

{
  "category": "题目所属学科分类，如：数学、英语、物理、化学、生物、历史、地理、政治、语文、其他",
  "tags": ["标签1", "标签2"],
  "difficulty": "EASY | MEDIUM | HARD",
  "confidence": 0.0-1.0
}

题目内容：
${text}`;

  const response = await callDashScope([
    { role: 'user', content: prompt }
  ], 0.2);

  if (!response.choices || response.choices.length === 0) {
    return { success: false, error: 'Classification failed: ' + JSON.stringify(response) };
  }

  const content = response.choices[0].message.content;
  let result = { category: '', tags: [], difficulty: 'MEDIUM', confidence: 0 };

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = { ...result, ...JSON.parse(jsonMatch[0]) };
    }
  } catch (e) {
    console.warn('Failed to parse classification JSON, returning raw text', e);
    result.category = content;
  }

  return { success: true, data: result };
}
