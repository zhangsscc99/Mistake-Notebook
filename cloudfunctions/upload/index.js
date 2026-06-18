const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const https = require('https');

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

function callDashScope(model, messages, temperature = 0.2) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model,
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
      case 'question':
        return await processQuestionPipeline(event);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

async function processQuestionPipeline(event) {
  const { fileID, category } = event;

  if (!fileID) {
    return { success: false, error: 'Missing fileID' };
  }

  // Step 1: Download image from cloud storage
  const downloadRes = await cloud.downloadFile({
    fileID: fileID
  });
  const buffer = downloadRes.fileContent;
  const base64Image = buffer.toString('base64');

  // Step 2: OCR - recognize text from image using VL model
  const ocrResponse = await callDashScope('qwen3-vl-plus', [
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
          text: '请识别这张图片中的所有文字内容，包括题目、选项、公式等。请完整、准确地提取所有可见文字。'
        }
      ]
    }
  ], 0.3);

  let recognizedText = '';
  if (ocrResponse.choices && ocrResponse.choices.length > 0) {
    recognizedText = ocrResponse.choices[0].message.content;
  } else {
    return { success: false, error: 'OCR failed: ' + JSON.stringify(ocrResponse) };
  }

  const ocrConfidence = (ocrResponse.usage && ocrResponse.usage.total_tokens > 0) ? 0.9 : 0.5;

  // Step 3: Classification
  const classifyPrompt = `请对以下题目进行分类。返回JSON格式（不要包含markdown代码块标记）：
{
  "category": "题目所属学科分类，如：数学、英语、物理、化学、生物、历史、地理、政治、语文、其他",
  "tags": ["标签1", "标签2"],
  "difficulty": "EASY | MEDIUM | HARD",
  "confidence": 0.0-1.0
}

题目内容：
${recognizedText}`;

  const classifyResponse = await callDashScope('qwen-turbo', [
    { role: 'user', content: classifyPrompt }
  ], 0.2);

  let classification = { category: category || '', tags: [], difficulty: 'MEDIUM', confidence: 0 };
  if (classifyResponse.choices && classifyResponse.choices.length > 0) {
    try {
      const text = classifyResponse.choices[0].message.content;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        classification = { ...classification, ...JSON.parse(jsonMatch[0]) };
      }
    } catch (e) {
      console.warn('Failed to parse classification response', e);
    }
  }

  // Step 4: Generate answer
  const answerPrompt = `请解答以下题目，给出详细的解题步骤和最终答案。

题目内容：
${recognizedText}

请以JSON格式返回（不要包含markdown代码块标记）：
{
  "answer": "最终的答案",
  "analysis": "详细的解题步骤和分析过程",
  "confidence": 0.0-1.0
}`;

  const answerResponse = await callDashScope('qwen-plus', [
    { role: 'user', content: answerPrompt }
  ], 0.2);

  let answerResult = { answer: '', analysis: '', confidence: 0 };
  if (answerResponse.choices && answerResponse.choices.length > 0) {
    try {
      const text = answerResponse.choices[0].message.content;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        answerResult = { ...answerResult, ...JSON.parse(jsonMatch[0]) };
      }
    } catch (e) {
      console.warn('Failed to parse answer response', e);
    }
  }

  // Step 5: Map category name to categoryId
  const targetCategory = classification.category || category;
  let categoryId = '';
  if (targetCategory) {
    const catResult = await db.collection('categories')
      .where({
        name: targetCategory,
        isDeleted: false
      })
      .get();
    if (catResult.data.length > 0) {
      categoryId = catResult.data[0]._id;
    }
  }

  // Step 6: Save to database
  const now = new Date().toISOString();
  const questionData = {
    content: recognizedText,
    imageUrl: fileID,
    categoryId,
    category: targetCategory || '',
    difficulty: classification.difficulty || 'MEDIUM',
    tags: classification.tags || [],
    ocrConfidence,
    aiConfidence: classification.confidence || answerResult.confidence || 0,
    aiAnswer: answerResult.answer || '',
    aiAnalysis: answerResult.analysis || '',
    isDeleted: false,
    createdAt: now,
    updatedAt: now
  };

  const insertResult = await db.collection('questions').add({
    data: questionData
  });

  return {
    success: true,
    data: {
      _id: insertResult._id,
      ...questionData,
      rawOcr: recognizedText,
      rawClassification: classification,
      rawAnswer: answerResult
    }
  };
}
