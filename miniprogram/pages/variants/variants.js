// pages/variants/variants.js
// 变式题生成页：?ids=id1,id2 —— 从分类详情多选进入
// AI 只生成不入库；学生勾选确认后才写入题库（question/saveVariants）
const DIFFICULTY_TEXT = { EASY: '简单', MEDIUM: '中等', HARD: '困难' };
const DIFFICULTY_CLASS = { EASY: 'easy', MEDIUM: 'medium', HARD: 'hard' };

Page({
  data: {
    loading: true,
    error: '',
    variants: [],
    selectedCount: 0,
    sourceQuestionIds: [],
    saving: false,
    saved: false
  },

  onLoad(options) {
    const ids = decodeURIComponent(options.ids || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (ids.length < 1) {
      this.setData({ loading: false, error: '请选择至少 1 道错题' });
      return;
    }
    this.generate(ids);
  },

  generate(ids) {
    this.setData({ loading: true, error: '' });
    wx.cloud.callFunction({
      name: 'answer',
      config: { timeout: 60000 },
      data: { action: 'generateVariants', questionIds: ids },
      success: (res) => {
        const result = res.result || {};
        if (result.success && result.data && (result.data.variants || []).length) {
          const variants = result.data.variants.map((v, i) => ({
            ...v,
            index: i + 1,
            selected: true,
            showAnswer: false,
            difficultyText: DIFFICULTY_TEXT[v.difficulty] || '中等',
            difficultyClass: DIFFICULTY_CLASS[v.difficulty] || 'medium'
          }));
          this.setData({
            loading: false,
            variants,
            selectedCount: variants.length,
            sourceQuestionIds: result.data.sourceQuestionIds || ids,
            category: (result.data.categories || [])[0] || ''
          });
        } else {
          this.setData({ loading: false, error: result.error || '生成失败，请返回重试' });
        }
      },
      fail: () => this.setData({ loading: false, error: '网络异常，请返回重试' })
    });
  },

  toggleVariant(e) {
    if (this.data.saved) return;
    const index = Number(e.currentTarget.dataset.index);
    const variants = this.data.variants.map((v, i) => (
      i === index ? { ...v, selected: !v.selected } : v
    ));
    this.setData({
      variants,
      selectedCount: variants.filter(v => v.selected).length
    });
  },

  toggleAnswer(e) {
    const index = Number(e.currentTarget.dataset.index);
    const variants = this.data.variants.map((v, i) => (
      i === index ? { ...v, showAnswer: !v.showAnswer } : v
    ));
    this.setData({ variants });
  },

  saveSelected() {
    if (this.data.saving || this.data.saved) return;
    const chosen = this.data.variants.filter(v => v.selected);
    if (!chosen.length) {
      wx.showToast({ title: '请先勾选要保存的变式题', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    wx.cloud.callFunction({
      name: 'question',
      config: { timeout: 30000 },
      data: {
        action: 'saveVariants',
        variants: chosen.map(v => ({
          content: v.content,
          answer: v.answer,
          analysis: v.analysis,
          difficulty: v.difficulty,
          knowledgePoint: v.knowledgePoint
        })),
        sourceQuestionIds: this.data.sourceQuestionIds,
        category: this.data.category
      },
      success: (res) => {
        const result = res.result || {};
        if (result.success && result.data && result.data.savedCount > 0) {
          this.setData({ saved: true });
          wx.showToast({ title: `已保存 ${result.data.savedCount} 道`, icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1200);
        } else {
          wx.showToast({ title: result.error || '保存失败，请重试', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络异常，请重试', icon: 'none' }),
      complete: () => this.setData({ saving: false })
    });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) });
  }
});
