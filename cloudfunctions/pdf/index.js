const cloud = require('wx-server-sdk');
const path = require('path');
const fs = require('fs');
const https = require('https');
const PDFDocument = require('pdfkit');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

const FONT_REGULAR = path.join(__dirname, 'ArialUnicode.ttf');

function resolveFontPath() {
  if (fs.existsSync(FONT_REGULAR)) {
    return FONT_REGULAR;
  }
  throw new Error('Chinese font missing: cloudfunctions/pdf/ArialUnicode.ttf');
}

function sanitizeText(text) {
  if (!text) return '';
  const raw = String(text).replace(/\r\n/g, '\n');
  const cleaned = raw
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    .replace(/\\mathbb\{([^}]*)\}/g, '$1')
    .replace(/\\overrightarrow\{([^}]*)\}/g, '$1')
    .replace(/\\triangle/g, '△')
    .replace(/\\infty/g, '∞')
    .replace(/\\cdot/g, '·')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned || raw.trim();
}

const PLACEHOLDER_ANALYSIS = 'AI暂未给出解析';
const PLACEHOLDER_ANSWER = '待补充';

function normalizeQuestionFields(q) {
  q.content = q.content || q.recognizedText || '';
  q.answer = q.answer || q.aiAnswer || PLACEHOLDER_ANSWER;
  q.analysis = q.analysis || q.aiAnalysis || PLACEHOLDER_ANALYSIS;
  return q;
}

function isMissingAnalysis(text) {
  return !text || text === PLACEHOLDER_ANALYSIS;
}

function isMissingAnswer(text) {
  return !text || text === PLACEHOLDER_ANSWER;
}

async function fetchQuestionFromDb(id) {
  if (!id) return null;
  try {
    const db = cloud.database();
    const result = await db.collection('questions').doc(String(id)).get();
    return result.data || null;
  } catch (err) {
    console.warn('fetchQuestionFromDb failed:', id, err.message);
    return null;
  }
}

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
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse DashScope response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function generateAnswerInline(text) {
  if (!text) return null;

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
    console.warn('DashScope answer failed:', JSON.stringify(response).slice(0, 300));
    return null;
  }

  const content = response.choices[0].message.content;
  let result = { answer: '', analysis: '', confidence: 0 };

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = { ...result, ...JSON.parse(jsonMatch[0]) };
    } else {
      result.answer = content;
    }
  } catch (e) {
    console.warn('Failed to parse answer JSON:', e.message);
    result.answer = content;
  }

  return result;
}

async function persistAnswerToDb(id, answer, analysis) {
  if (!id) return;
  try {
    const db = cloud.database();
    await db.collection('questions').doc(String(id)).update({
      data: {
        aiAnswer: answer || '',
        aiAnalysis: analysis || '',
        updatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.warn('persistAnswerToDb failed:', id, err.message);
  }
}

exports.main = async (event, context) => {
  const { action } = event;

  try {
    switch (action) {
      case 'generate':
        return await generatePDF(event);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

async function fillMissingAnalysis(questions) {
  questions.forEach(normalizeQuestionFields);

  const indices = questions.reduce((acc, q, i) => {
    if (isMissingAnalysis(q.analysis) || isMissingAnswer(q.answer)) {
      acc.push(i);
    }
    return acc;
  }, []);

  if (indices.length === 0) return;

  for (const i of indices) {
    const q = questions[i];

    if (q.id && (isMissingAnalysis(q.analysis) || isMissingAnswer(q.answer))) {
      const record = await fetchQuestionFromDb(q.id);
      if (record) {
        if (isMissingAnswer(q.answer) && record.aiAnswer) {
          q.answer = record.aiAnswer;
        }
        if (isMissingAnalysis(q.analysis) && record.aiAnalysis) {
          q.analysis = record.aiAnalysis;
        }
      }
    }

    // 试卷里没存 id 时，用题目内容回查题库
    if ((isMissingAnalysis(q.analysis) || isMissingAnswer(q.answer)) && q.content) {
      try {
        const db = cloud.database();
        const lookup = await db.collection('questions')
          .where({ content: q.content, isDeleted: false })
          .limit(1)
          .get();
        const record = lookup.data && lookup.data[0];
        if (record) {
          q.id = q.id || record._id;
          if (isMissingAnswer(q.answer) && record.aiAnswer) {
            q.answer = record.aiAnswer;
          }
          if (isMissingAnalysis(q.analysis) && record.aiAnalysis) {
            q.analysis = record.aiAnalysis;
          }
        }
      } catch (err) {
        console.warn('lookupQuestionByContent failed:', err.message);
      }
    }

    if (!isMissingAnalysis(q.analysis) && !isMissingAnswer(q.answer)) {
      continue;
    }

    try {
      const generated = await generateAnswerInline(q.content);
      if (!generated) continue;
      if (isMissingAnswer(q.answer) && generated.answer) {
        q.answer = generated.answer;
      }
      if (isMissingAnalysis(q.analysis) && generated.analysis) {
        q.analysis = generated.analysis;
      }
      if (q.id && (generated.answer || generated.analysis)) {
        await persistAnswerToDb(q.id, q.answer, q.analysis);
      }
    } catch (err) {
      console.warn('generateAnswerInline failed:', err.message);
    }
  }
}

async function generatePDF(event) {
  const { title, duration, totalScore, questions, withAnalysis } = event;

  if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
    return { success: false, error: 'Missing required fields: title, questions' };
  }

  if (withAnalysis) {
    await fillMissingAnalysis(questions);
  }

  questions.forEach(normalizeQuestionFields);

  const fontPath = resolveFontPath();
  const safeTitle = sanitizeText(title);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    autoFirstPage: true
  });

  const buffers = [];
  doc.on('data', (chunk) => buffers.push(chunk));

  const pdfBuffer = await new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.font(fontPath).fontSize(22).text(safeTitle, { align: 'center' });
    doc.moveDown(0.5);

    doc.font(fontPath).fontSize(12)
      .text(`考试时间：${duration || 90} 分钟   总分：${totalScore || 100} 分`, { align: 'center' });
    doc.moveDown(0.5);

    doc.moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor('#cccccc')
      .stroke();
    doc.moveDown(0.5);

    doc.font(fontPath).fontSize(12)
      .text('姓名：______________    班级：______________    得分：______________');
    doc.moveDown(1);

    questions.forEach((q, index) => {
      const questionNumber = index + 1;
      const content = sanitizeText(q.content);
      const answer = sanitizeText(q.answer || '待补充');
      const analysis = sanitizeText(q.analysis || 'AI暂未给出解析');

      if (doc.y > 700) {
        doc.addPage();
      }

      doc.font(fontPath).fontSize(12)
        .text(`${questionNumber}. ${content}`, {
          indent: 0,
          paragraphGap: 4,
          lineGap: 2
        });

      if (q.tags && q.tags.length > 0) {
        doc.font(fontPath).fontSize(9)
          .fillColor('#888888')
          .text(`[${q.tags.map(sanitizeText).join(', ')}]${q.difficulty ? '  [' + sanitizeText(q.difficulty) + ']' : ''}`, { indent: 15 })
          .fillColor('#000000');
      }

      doc.moveDown(0.5);

      if (withAnalysis) {
        if (doc.y > 620) {
          doc.addPage();
        }
        doc.font(fontPath).fontSize(11)
          .fillColor('#4caf50')
          .text('参考答案', { indent: 15 });
        doc.font(fontPath).fontSize(11)
          .fillColor('#000000')
          .text(answer, { indent: 15, paragraphGap: 4, lineGap: 2 });
        doc.font(fontPath).fontSize(11)
          .fillColor('#2196f3')
          .text('详细解析', { indent: 15 });
        doc.font(fontPath).fontSize(11)
          .fillColor('#000000')
          .text(analysis, { indent: 15, paragraphGap: 4, lineGap: 2 });
        doc.moveDown(0.5);
      }

      if (!withAnalysis && q.needsAnswerArea !== false) {
        const answerStartY = doc.y;
        const answerLines = estimateAnswerLines(content);

        for (let i = 0; i < answerLines; i++) {
          const lineY = answerStartY + (i * 24);
          if (lineY > 740) break;

          doc.moveTo(65, lineY)
            .lineTo(545, lineY)
            .strokeColor('#e0e0e0')
            .stroke();
        }

        doc.y = answerStartY + (answerLines * 24) + 10;
      }

      doc.moveDown(0.5);

      if (index < questions.length - 1) {
        doc.moveTo(50, doc.y)
          .lineTo(545, doc.y)
          .strokeColor('#eeeeee')
          .stroke();
        doc.moveDown(0.5);
      }
    });

    doc.end();
  });

  const timestamp = Date.now();
  const fileSafeTitle = safeTitle.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 30);
  const fileName = `papers/${fileSafeTitle}_${timestamp}.pdf`;

  const uploadResult = await cloud.uploadFile({
    cloudPath: fileName,
    fileContent: pdfBuffer
  });

  return {
    success: true,
    data: {
      fileID: uploadResult.fileID,
      fileName: fileName
    }
  };
}

function estimateAnswerLines(content) {
  const contentLength = content ? content.length : 0;
  if (contentLength < 30) return 4;
  if (contentLength < 60) return 6;
  if (contentLength < 100) return 8;
  return 10;
}
