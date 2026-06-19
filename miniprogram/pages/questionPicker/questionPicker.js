const app = getApp();

function isDifficultQuestion(segment) {
  const type = segment.type || '';
  const confidence = typeof segment.confidence === 'number' ? segment.confidence : 1;
  return type.includes('解答') || confidence < 0.85;
}

function getConfidenceLabel(confidence) {
  if (!confidence || confidence === 0) return '';
  if (confidence >= 0.9) return '简单';
  if (confidence >= 0.8) return '中等';
  return '困难';
}

Page({
  data: {
    imagePath: '',
    fileID: '',
    questions: [],
    categories: [],
    selectedCategory: '数学',
    selectedDifficulty: '中等',
    selectedPeriod: '高中',
    difficulties: ['简单', '中等', '困难'],
    periods: ['小学', '初中', '高中', '大学'],
    selectedCount: 0,
    saving: false,
    showPickerModal: false,
    tempCategory: '数学',
    tempDifficulty: '中等',
    tempPeriod: '高中'
  },

  onLoad: function () {
    const draft = app.globalData.recognitionDraft;
    if (!draft || !draft.segments || !draft.segments.length) {
      wx.showToast({ title: '无识别结果', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    const questions = draft.segments.map((segment, index) => {
      const conf = segment.confidence || 0;
      return {
        id: String(index + 1),
        text: segment.content || segment.text || '',
        type: segment.type || '',
        subject: segment.subject || '',
        confidence: conf,
        confidenceLabel: getConfidenceLabel(conf),
        bounds: segment.bounds || null,
        selected: segment.isDifficult !== undefined
          ? !!segment.isDifficult
          : isDifficultQuestion(segment)
      };
    }).filter((q) => q.text);

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

  openCategoryPicker: function () {
    this.setData({
      showPickerModal: true,
      tempCategory: this.data.selectedCategory,
      tempDifficulty: this.data.selectedDifficulty,
      tempPeriod: this.data.selectedPeriod
    });
  },

  closePickerModal: function () {
    this.setData({ showPickerModal: false });
  },

  onTempCategorySelect: function (e) {
    this.setData({ tempCategory: e.currentTarget.dataset.name });
  },

  onTempDifficultySelect: function (e) {
    this.setData({ tempDifficulty: e.currentTarget.dataset.value });
  },

  onTempPeriodSelect: function (e) {
    this.setData({ tempPeriod: e.currentTarget.dataset.value });
  },

  confirmPickerModal: function () {
    this.setData({
      selectedCategory: this.data.tempCategory,
      selectedDifficulty: this.data.tempDifficulty,
      selectedPeriod: this.data.tempPeriod,
      showPickerModal: false
    });
  },

  callQuestion: function (action, payload, timeoutMs) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'question',
        config: { timeout: timeoutMs || 60000 },
        data: { action, ...payload },
        success: (res) => resolve(res.result || {}),
        fail: reject
      });
    });
  },

  saveSelected: function () {
    const selectedQuestions = this.data.questions.filter((q) => q.selected);
    if (!selectedQuestions.length) {
      wx.showToast({ title: '请至少选择一道题', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '正在保存...', mask: true });

    this.callQuestion('batchSave', {
      questions: selectedQuestions,
      category: this.data.selectedCategory,
      difficulty: this.data.selectedDifficulty,
      imageUrl: this.data.fileID
    }, 20000).then((saveRes) => {
      if (!saveRes.success) {
        throw new Error(saveRes.error || '保存失败');
      }

      const saved = saveRes.data.questions || [];
      if (!saved.length) {
        throw new Error('没有成功保存的题目');
      }

      return saveRes;
    }).then((saveRes) => {
      wx.hideLoading();
      this.setData({ saving: false });
      app.globalData.recognitionDraft = null;
      const count = saveRes.data.savedCount || selectedQuestions.length;
      wx.showToast({ title: `已保存${count}道，AI解析中`, icon: 'none', duration: 2000 });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/categories/categories' });
      }, 800);
    }).catch((err) => {
      wx.hideLoading();
      this.setData({ saving: false });
      wx.showModal({
        title: '保存失败',
        content: (err && err.message) || (err && err.errMsg) || '请稍后重试',
        showCancel: false
      });
    });
  }
});
