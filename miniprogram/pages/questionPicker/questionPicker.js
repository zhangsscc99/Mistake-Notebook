const app = getApp();

function isDifficultQuestion(segment) {
  const type = segment.type || '';
  const confidence = typeof segment.confidence === 'number' ? segment.confidence : 1;
  return type.includes('解答') || confidence < 0.85;
}

Page({
  data: {
    imagePath: '',
    fileID: '',
    questions: [],
    categories: [],
    selectedCategory: '数学',
    selectedDifficulty: '中等',
    difficulties: ['简单', '中等', '困难'],
    selectedCount: 0,
    saving: false
  },

  onLoad: function () {
    const draft = app.globalData.recognitionDraft;
    if (!draft || !draft.segments || !draft.segments.length) {
      wx.showToast({ title: '无识别结果', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    const questions = draft.segments.map((segment, index) => ({
      id: String(index + 1),
      text: segment.content || segment.text || '',
      type: segment.type || '',
      subject: segment.subject || '',
      confidence: segment.confidence || 0,
      bounds: segment.bounds || null,
      selected: segment.isDifficult !== undefined
        ? !!segment.isDifficult
        : isDifficultQuestion(segment)
    })).filter((q) => q.text);

    const defaultCategory = questions[0] && questions[0].subject ? questions[0].subject : '数学';

    this.setData({
      imagePath: draft.tempFilePath || '',
      fileID: draft.fileID || '',
      questions,
      selectedCategory: defaultCategory,
      selectedCount: questions.filter((q) => q.selected).length
    });

    this.fetchCategories();
  },

  fetchCategories: function () {
    wx.cloud.callFunction({
      name: 'category',
      data: { action: 'list' },
      success: (res) => {
        if (res.result && res.result.success && res.result.data.length) {
          this.setData({ categories: res.result.data });
        } else {
          this.setData({
            categories: [
              { name: '数学' }, { name: '物理' }, { name: '化学' },
              { name: '英语' }, { name: '语文' }
            ]
          });
        }
      },
      fail: () => {
        this.setData({
          categories: [
            { name: '数学' }, { name: '物理' }, { name: '化学' },
            { name: '英语' }, { name: '语文' }
          ]
        });
      }
    });
  },

  toggleQuestionOverlay: function (e) {
    const id = e.currentTarget.dataset.id;
    const questions = this.data.questions.map((q) => (
      q.id === id ? { ...q, selected: !q.selected } : q
    ));
    this.setData({
      questions,
      selectedCount: questions.filter((q) => q.selected).length
    });
  },

  onQuestionChange: function (e) {
    const selectedIds = e.detail.value || [];
    const questions = this.data.questions.map((q) => ({
      ...q,
      selected: selectedIds.indexOf(q.id) !== -1
    }));
    this.setData({
      questions,
      selectedCount: selectedIds.length
    });
  },

  selectCategory: function (e) {
    this.setData({ selectedCategory: e.currentTarget.dataset.name });
  },

  selectDifficulty: function (e) {
    this.setData({ selectedDifficulty: e.currentTarget.dataset.value });
  },

  saveSelected: function () {
    const selectedQuestions = this.data.questions.filter((q) => q.selected);
    if (!selectedQuestions.length) {
      wx.showToast({ title: '请至少选择一道题', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...', mask: true });

    wx.cloud.callFunction({
      name: 'question',
      data: {
        action: 'batchSave',
        questions: selectedQuestions,
        category: this.data.selectedCategory,
        difficulty: this.data.selectedDifficulty,
        imageUrl: this.data.fileID
      },
      success: (res) => {
        wx.hideLoading();
        this.setData({ saving: false });
        if (res.result && res.result.success) {
          app.globalData.recognitionDraft = null;
          const count = res.result.data.savedCount || selectedQuestions.length;
          wx.showToast({ title: `已保存${count}道题`, icon: 'success' });
          setTimeout(() => {
            wx.switchTab({ url: '/pages/categories/categories' });
          }, 1000);
        } else {
          wx.showModal({
            title: '保存失败',
            content: (res.result && res.result.error) || '请稍后重试',
            showCancel: false
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        this.setData({ saving: false });
        wx.showModal({
          title: '保存失败',
          content: (err && err.errMsg) || '云函数调用失败',
          showCancel: false
        });
      }
    });
  }
});
