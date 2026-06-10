const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const https = require('https');

const DASHSCOPE_API_KEY = 'sk-b2ccb84e15b544bc84e9a8a02cb4e168';
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

function callDashScopeVL(messages, temperature = 0.3) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'qwen3-vl-plus',
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
      case 'segment':
        return await segmentQuestions(event);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

async function segmentQuestions(event) {
  const { fileID } = event;

  if (!fileID) {
    return { success: false, error: 'Missing fileID' };
  }

  // Download image from cloud storage
  const downloadRes = await cloud.downloadFile({
    fileID: fileID
  });
  const buffer = downloadRes.fileContent;
  const base64Image = buffer.toString('base64');

  const prompt = `这张图片可能包含多道题目。请识别并分割图片中的每一道题目。

对每一道题目，请提取以下信息并按JSON数组格式返回（不要包含markdown代码块标记）：

[
  {
    "content": "题目的完整文字内容",
    "type": "选择题 | 填空题 | 解答题 | 判断题 | 其他",
    "subject": "学科分类（如：数学、英语、物理等）",
    "confidence": 0.0-1.0,
    "bounds": {
      "x": 0,
      "y": 0,
      "width": 0,
      "height": 0
    }
  }
]

如果图片中只有一道题目，也请按数组格式返回。请确保提取尽可能完整的题目内容。`;

  const response = await callDashScopeVL([
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${base64Image}`
          }
        },
        {
          type: 'text',
          text: prompt
        }
      ]
    }
  ], 0.3);

  if (!response.choices || response.choices.length === 0) {
    return { success: false, error: 'Segmentation failed: ' + JSON.stringify(response) };
  }

  const content = response.choices[0].message.content;
  let segments = [];

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      segments = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn('Failed to parse segmentation JSON, returning raw text', e);
    segments = [{ content, type: '其他', subject: '', confidence: 0.5, bounds: null }];
  }

  if (!Array.isArray(segments)) {
    segments = [{ content, type: '其他', subject: '', confidence: 0.5, bounds: null }];
  }

  return { success: true, data: { segments, count: segments.length } };
}
