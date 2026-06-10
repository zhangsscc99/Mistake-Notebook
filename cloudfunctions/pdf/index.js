const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const PDFDocument = require('pdfkit');

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

async function generatePDF(event) {
  const { title, duration, totalScore, questions } = event;

  if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
    return { success: false, error: 'Missing required fields: title, questions' };
  }

  // Build PDF in memory
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });

  const buffers = [];
  doc.on('data', (chunk) => buffers.push(chunk));

  const pdfBuffer = await new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Title
    doc.fontSize(22).font('Helvetica-Bold')
      .text(title, { align: 'center' });
    doc.moveDown(0.5);

    // Info line
    doc.fontSize(12).font('Helvetica')
      .text(`考试时间：${duration || 90} 分钟   总分：${totalScore || 100} 分`, { align: 'center' });
    doc.moveDown(0.5);

    // Separator line
    doc.moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor('#cccccc')
      .stroke();
    doc.moveDown(0.5);

    // Student info
    doc.fontSize(12)
      .text('姓名：______________    班级：______________    得分：______________');
    doc.moveDown(1);

    // Questions
    questions.forEach((q, index) => {
      const questionNumber = index + 1;

      // Check page space - if less than 80px remaining, start new page
      if (doc.y > 700) {
        doc.addPage();
      }

      // Question number and content
      doc.fontSize(12).font('Helvetica-Bold')
        .text(`${questionNumber}. `, { continued: false });

      doc.fontSize(12).font('Helvetica')
        .text(q.content || '', {
          indent: 15,
          paragraphGap: 4
        });

      // Tags / metadata
      if (q.tags && q.tags.length > 0) {
        doc.fontSize(9).font('Helvetica')
          .fillColor('#888888')
          .text(`[${q.tags.join(', ')}]${q.difficulty ? '  [' + q.difficulty + ']' : ''}`, { indent: 15 })
          .fillColor('#000000');
      }

      doc.moveDown(0.5);

      // Answer area
      if (q.needsAnswerArea !== false) {
        const answerStartY = doc.y;
        const answerLines = estimateAnswerLines(q.content);

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

      // Separator between questions
      if (index < questions.length - 1) {
        doc.moveTo(50, doc.y)
          .lineTo(545, doc.y)
          .strokeColor('#eeeeee')
          .stroke();
        doc.moveDown(0.5);
      }
    });

    // End of document
    doc.end();
  });

  // Generate filename
  const timestamp = Date.now();
  const safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 30);
  const fileName = `papers/${safeTitle}_${timestamp}.pdf`;

  // Upload to cloud storage
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
