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
    wx.navigateTo({
      url: '/pages/questionSelector/questionSelector'
    });
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
      confirmText: '生成PDF',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) {
          this.generatePDF(paper);
        }
      }
    });
  },

  generatePDF: function (paper) {
    wx.showLoading({ title: '正在生成...' });
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ title: 'PDF 生成成功', icon: 'success' });
    }, 1500);
  }
});
