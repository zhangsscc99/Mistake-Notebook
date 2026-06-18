// pages/paperBuilder/paperBuilder.js
const app = getApp();
const { normalizePaperQuestion } = require('../../utils/paper.js');

Page({
  data: {
    savedPapers: [],
    totalQuestionCount: 0
  },

  onShow: function () {
    app.globalData.selectedPaperQuestions = [];
    this.loadSavedPapers();
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
          that.setSavedPapers(papers);
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
      this.setSavedPapers(papers);
    } catch (e) {
      this.setSavedPapers([]);
    }
  },

  setSavedPapers: function (papers) {
    const list = papers || [];
    const totalQuestionCount = list.reduce((sum, p) => sum + (p.questionCount || (p.questions ? p.questions.length : 0)), 0);
    this.setData({ savedPapers: list, totalQuestionCount });
  },

  createNewPaper: function () {
    app.globalData.selectedPaperQuestions = [];
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
      title: '正在生成PDF...',
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
