const cloud = require('wx-server-sdk');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

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
    // 去除 markdown 噪音
    .replace(/```[a-zA-Z]*\n?/g, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|\n)\s*[-*]\s+/g, '$1')
    .replace(/(^|\n)\s*(?:[-*_]\s*){3,}(?=\n|$)/g, '$1')
    // 收紧空白：行尾空格、空行、行首空格
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return cleaned || raw.trim();
}

const PLACEHOLDER_ANALYSIS = 'AI暂未给出解析';
const PLACEHOLDER_ANSWER = '待补充';
const PENDING_ANALYSIS = '解析生成中，请稍后重新导出';
const PENDING_ANSWER = '答案生成中，请稍后重新导出';

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

function hasUsableText(text, placeholder) {
  return text && text !== placeholder;
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

async function lookupQuestionByContent(content) {
  if (!content) return null;
  try {
    const db = cloud.database();
    const lookup = await db.collection('questions')
      .where({ content, isDeleted: false })
      .limit(1)
      .get();
    return (lookup.data && lookup.data[0]) || null;
  } catch (err) {
    console.warn('lookupQuestionByContent failed:', err.message);
    return null;
  }
}

function applyRecordFields(q, record) {
  if (!record) return;
  q.id = q.id || record._id;
  if (isMissingAnswer(q.answer) && hasUsableText(record.aiAnswer, '')) {
    q.answer = record.aiAnswer;
  }
  if (isMissingAnalysis(q.analysis) && hasUsableText(record.aiAnalysis, '')) {
    q.analysis = record.aiAnalysis;
  }
  if ((record.aiStatus === 'pending' || record.aiStatus === 'processing') && isMissingAnswer(q.answer) && isMissingAnalysis(q.analysis)) {
    q.answer = PENDING_ANSWER;
    q.analysis = PENDING_ANALYSIS;
  }
}

async function hydrateQuestionFromDb(q) {
  if (q.id) {
    applyRecordFields(q, await fetchQuestionFromDb(q.id));
  }
  if ((isMissingAnalysis(q.analysis) || isMissingAnswer(q.answer)) && q.content) {
    applyRecordFields(q, await lookupQuestionByContent(q.content));
  }
  if (isMissingAnswer(q.answer)) q.answer = PENDING_ANSWER;
  if (isMissingAnalysis(q.analysis)) q.analysis = PENDING_ANALYSIS;
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

  const needsHydrate = questions.filter(
    (q) => isMissingAnalysis(q.analysis) || isMissingAnswer(q.answer)
  );
  if (needsHydrate.length === 0) return;

  await Promise.all(needsHydrate.map((q) => hydrateQuestionFromDb(q)));
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
      const answer = sanitizeText(q.answer || PENDING_ANSWER);
      const analysis = sanitizeText(q.analysis || PENDING_ANALYSIS);

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
        doc.moveDown(0.2);
        doc.font(fontPath).fontSize(11)
          .fillColor('#222222')
          .text(answer, { indent: 15, align: 'justify', lineGap: 3 });
        doc.moveDown(0.4);
        doc.font(fontPath).fontSize(11)
          .fillColor('#2196f3')
          .text('详细解析', { indent: 15 });
        doc.moveDown(0.2);
        doc.font(fontPath).fontSize(11)
          .fillColor('#222222')
          .text(analysis, { indent: 15, align: 'justify', lineGap: 3 });
        doc.moveDown(0.6);
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
