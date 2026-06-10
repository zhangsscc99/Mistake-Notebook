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
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

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
