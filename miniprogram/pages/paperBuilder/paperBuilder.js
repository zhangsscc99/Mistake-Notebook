// pages/paperBuilder/paperBuilder.js
const app = getApp();

Page({
  data: {
    savedPapers: []
  },

  onShow: function () {
    this.loadSavedPapers();
  },

  loadSavedPapers: function () {
    try {
      const papersJson = wx.getStorageSync('savedPapers');
      const papers = papersJson ? JSON.parse(papersJson) : [];
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
    wx.showLoading({ title: '正在生成PDF...', mask: true });
    wx.cloud.callFunction({
      name: 'pdf',
      data: {
        action: 'generate',
        title: paper.title,
        duration: paper.duration || 90,
        totalScore: paper.totalScore || paper.questionCount * 5,
        withAnalysis: !!withAnalysis,
        questions: (paper.questions || []).map((q) => ({
          content: q.content,
          answer: q.answer,
          analysis: q.analysis,
          tags: q.tags || [],
          difficulty: q.difficulty,
          needsAnswerArea: !withAnalysis
        }))
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
