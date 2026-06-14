// pages/paperBuilder/paperBuilder.js
const app = getApp();

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

Page({
  data: {
    savedPapers: [],
    pendingQuestions: [],
    pendingCount: 0
  },

  onShow: function () {
    this.loadPendingDraft();
    this.loadSavedPapers();
  },

  loadPendingDraft: function () {
    const pending = app.globalData.selectedPaperQuestions || [];
    this.setData({
      pendingQuestions: pending,
      pendingCount: pending.length
    });
  },

  clearPendingDraft: function (silent) {
    app.globalData.selectedPaperQuestions = [];
    this.setData({ pendingQuestions: [], pendingCount: 0 });
    if (!silent) {
      wx.showToast({ title: '已清空', icon: 'none' });
    }
  },

  savePendingAsPaper: function () {
    const pending = app.globalData.selectedPaperQuestions || [];
    if (!pending.length) {
      wx.showToast({ title: '请先选择题目', icon: 'none' });
      return;
    }

    const defaultTitle = pending[0].categoryName
      ? `${pending[0].categoryName}练习卷`
      : '练习卷';

    wx.showModal({
      title: '保存试卷',
      editable: true,
      placeholderText: '例如：数学第一次月考',
      content: defaultTitle,
      confirmText: '保存',
      success: (res) => {
        if (!res.confirm) return;
        const title = (res.content || '').trim();
        if (!title) {
          wx.showToast({ title: '请输入试卷名称', icon: 'none' });
          return;
        }

        const paper = {
          id: Date.now(),
          title,
          questionCount: pending.length,
          questions: pending.map((q) => {
            const normalized = normalizePaperQuestion(q);
            return {
              id: normalized.id,
              content: normalized.content,
              answer: normalized.answer,
              analysis: normalized.analysis,
              categoryId: normalized.categoryId,
              categoryName: normalized.categoryName,
              tags: normalized.tags || [],
              difficulty: normalized.difficulty
            };
          }),
          duration: 90,
          totalScore: pending.length * 5,
          createdAt: new Date().toLocaleDateString()
        };

        const persistLocal = () => {
          const papersJson = wx.getStorageSync('savedPapers');
          const papers = papersJson ? JSON.parse(papersJson) : [];
          papers.unshift(paper);
          wx.setStorageSync('savedPapers', JSON.stringify(papers));
          this.setData({ savedPapers: papers });
        };

        wx.cloud.callFunction({
          name: 'paper',
          data: { action: 'save', paper },
          success: (cloudRes) => {
            if (cloudRes.result && cloudRes.result.success && cloudRes.result.data) {
              const cloudPaper = cloudRes.result.data;
              paper.id = cloudPaper.id || cloudPaper._id || paper.id;
            }
            try {
              persistLocal();
            } catch (e) {
              wx.showToast({ title: '本地保存失败', icon: 'none' });
              return;
            }
            this.clearPendingDraft(true);
            wx.showToast({ title: '试卷保存成功', icon: 'success' });
          },
          fail: () => {
            try {
              persistLocal();
              this.clearPendingDraft(true);
              wx.showToast({ title: '已本地保存', icon: 'success' });
            } catch (e) {
              wx.showToast({ title: '保存失败', icon: 'none' });
            }
          }
        });
      }
    });
  },

  loadSavedPapers: function () {
    const that = this;
    wx.cloud.callFunction({
      name: 'paper',
      data: { action: 'list' },
      success: (res) => {
        if (res.result && res.result.success && Array.isArray(res.result.data)) {
          const papers = res.result.data.map((p) => ({
            id: p.id || p._id,
            title: p.title,
            questionCount: p.questionCount,
            questions: (p.questions || []).map(normalizePaperQuestion),
            duration: p.duration || 90,
            totalScore: p.totalScore || (p.questionCount || 0) * 5,
            createdAt: p.createdAt ? String(p.createdAt).split('T')[0] : ''
          }));
          try {
            wx.setStorageSync('savedPapers', JSON.stringify(papers));
          } catch (e) {
            // ignore cache errors
          }
          that.setData({ savedPapers: papers });
          return;
        }
        that.loadLocalPapers();
      },
      fail: () => {
        that.loadLocalPapers();
      }
    });
  },

  loadLocalPapers: function () {
    try {
      const papersJson = wx.getStorageSync('savedPapers');
      const raw = papersJson ? JSON.parse(papersJson) : [];
      const papers = raw.map((p) => ({
        ...p,
        questions: (p.questions || []).map(normalizePaperQuestion)
      }));
      this.setData({ savedPapers: papers });
    } catch (e) {
      this.setData({ savedPapers: [] });
    }
  },

  createNewPaper: function () {
    app.globalData.categoriesMode = 'paper-builder';
    wx.switchTab({ url: '/pages/categories/categories' });
  },

  viewPaper: function (e) {
    const index = e.currentTarget.dataset.index;
    const paper = this.data.savedPapers[index];
    if (!paper) return;

    const questionsList = paper.questions
      ? paper.questions.map((q, i) => `${i + 1}. ${q.content}`).join('\n')
      : '暂无题目内容';

    wx.showModal({
      title: paper.title,
      content: `共 ${paper.questionCount} 道题\n创建时间：${paper.createdAt}\n\n${questionsList.slice(0, 200)}${questionsList.length > 200 ? '...' : ''}`,
      confirmText: '导出PDF',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) {
          this.showExportOptions(paper);
        }
      }
    });
  },

  showExportOptions: function (paper) {
    wx.showActionSheet({
      itemList: ['带解析版', '不带解析版'],
      success: (res) => {
        this.generatePDF(paper, res.tapIndex === 0);
      }
    });
  },

  generatePDF: function (paper, withAnalysis) {
    wx.showLoading({
      title: withAnalysis ? '正在生成解析...' : '正在生成PDF...',
      mask: true
    });
    wx.cloud.callFunction({
      name: 'pdf',
      config: { timeout: 120000 },
      data: {
        action: 'generate',
        title: paper.title,
        duration: paper.duration || 90,
        totalScore: paper.totalScore || paper.questionCount * 5,
        withAnalysis: !!withAnalysis,
        questions: (paper.questions || []).map((q) => {
          const normalized = normalizePaperQuestion(q);
          return {
            id: normalized.id,
            content: normalized.content,
            answer: normalized.answer,
            analysis: normalized.analysis,
            tags: normalized.tags || [],
            difficulty: normalized.difficulty,
            needsAnswerArea: !withAnalysis
          };
        })
      },
      success: (res) => {
        wx.hideLoading();
        if (!res.result || !res.result.success) {
          wx.showToast({ title: (res.result && res.result.error) || '生成失败', icon: 'none' });
          return;
        }
        const fileID = res.result.data.fileID;
        wx.cloud.downloadFile({
          fileID,
          success: (dl) => {
            wx.openDocument({
              filePath: dl.tempFilePath,
              fileType: 'pdf',
              showMenu: true,
              fail: () => {
                wx.showToast({ title: 'PDF已生成', icon: 'success' });
              }
            });
          },
          fail: () => {
            wx.showToast({ title: 'PDF已生成', icon: 'success' });
          }
        });
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showModal({
          title: '导出失败',
          content: err.errMsg || '请稍后重试',
          showCancel: false
        });
      }
    });
  }
});
