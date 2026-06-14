function normalizePaperQuestion(q) {
  if (!q) return q;
  return {
    ...q,
    id: q.id || q._id,
    content: q.content || q.recognizedText || '',
    answer: q.answer || q.aiAnswer || '待补充',
    analysis: q.analysis || q.aiAnalysis || 'AI暂未给出解析'
  };
}

function buildPaperPayload(questions, title) {
  const pending = (questions || []).map(normalizePaperQuestion);
  return {
    id: Date.now(),
    title,
    questionCount: pending.length,
    questions: pending.map((q) => ({
      id: q.id,
      content: q.content,
      answer: q.answer,
      analysis: q.analysis,
      categoryId: q.categoryId,
      categoryName: q.categoryName,
      tags: q.tags || [],
      difficulty: q.difficulty
    })),
    duration: 90,
    totalScore: pending.length * 5,
    createdAt: new Date().toLocaleDateString()
  };
}

function persistPaperLocal(paper) {
  const papersJson = wx.getStorageSync('savedPapers');
  const papers = papersJson ? JSON.parse(papersJson) : [];
  papers.unshift(paper);
  wx.setStorageSync('savedPapers', JSON.stringify(papers));
  return papers;
}

/**
 * 保存试卷到云端并写入本地缓存
 * @returns {Promise<{paper: object, papers: object[]}>}
 */
function savePaperToCloud(questions, title) {
  const paper = buildPaperPayload(questions, title);

  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'paper',
      data: { action: 'save', paper },
      success: (cloudRes) => {
        if (cloudRes.result && cloudRes.result.success && cloudRes.result.data) {
          const cloudPaper = cloudRes.result.data;
          paper.id = cloudPaper.id || cloudPaper._id || paper.id;
        }
        try {
          const papers = persistPaperLocal(paper);
          resolve({ paper, papers });
        } catch (e) {
          reject(e);
        }
      },
      fail: () => {
        try {
          const papers = persistPaperLocal(paper);
          resolve({ paper, papers, localOnly: true });
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

function promptPaperTitle(defaultTitle) {
  return new Promise((resolve, reject) => {
    wx.showModal({
      title: '保存试卷',
      editable: true,
      placeholderText: '例如：数学第一次月考',
      content: defaultTitle,
      confirmText: '保存',
      success: (res) => {
        if (!res.confirm) {
          reject(new Error('cancelled'));
          return;
        }
        const title = (res.content || '').trim();
        if (!title) {
          wx.showToast({ title: '请输入试卷名称', icon: 'none' });
          reject(new Error('empty_title'));
          return;
        }
        resolve(title);
      },
      fail: reject
    });
  });
}

module.exports = {
  normalizePaperQuestion,
  buildPaperPayload,
  savePaperToCloud,
  promptPaperTitle
};
