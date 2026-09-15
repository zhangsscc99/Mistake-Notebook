// pages/variants/variants.js
// 变式题生成页：?ids=id1,id2
// 先选数量（≥ 原题数，每道原题至少 1 道对应变式），再生成；勾选后才入库。
const DIFFICULTY_TEXT = { EASY: '简单', MEDIUM: '中等', HARD: '困难' };
const DIFFICULTY_CLASS = { EASY: 'easy', MEDIUM: 'medium', HARD: 'hard' };
const MAX_COUNT = 10;

function defaultCount(sourceCount) {
  if (sourceCount <= 1) return Math.min(3, MAX_COUNT);
  return Math.min(sourceCount, MAX_COUNT);
}

Page({
  data: {
    stage: 'pick',
    error: '',
    ids: [],
    sourceCount: 0,
    minCount: 1,
    maxCount: MAX_COUNT,
    count: 3,
    extraCount: 0,
    variants: [],
    selectedCount: 0,
    sourceQuestionIds: [],
    saving: false,
    saved: false
  },

  onLoad(options) {
    const ids = decodeURIComponent(options.ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_COUNT);
    if (ids.length < 1) {
      this.setData({ stage: 'error', error: '请选择至少 1 道错题' });
      return;
    }
    const sourceCount = ids.length;
    const minCount = sourceCount;
    const count = defaultCount(sourceCount);
    this.setData({
      ids,
      sourceCount,
      minCount,
      maxCount: MAX_COUNT,
      count,
      extraCount: Math.max(0, count - sourceCount)
    });
  },

  bumpCount(e) {
    const delta = Number(e.currentTarget.dataset.delta) || 0;
    const next = Math.max(this.data.minCount, Math.min(this.data.maxCount, this.data.count + delta));
    this.setData({
      count: next,
      extraCount: Math.max(0, next - this.data.sourceCount)
    });
  },

  startGenerate() {
    this.generate(this.data.ids, this.data.count);
  },

  retryPick() {
    this.setData({ stage: 'pick', error: '', variants: [] });
  },

  generate(ids, count) {
    this.setData({ stage: 'loading', error: '' });
    wx.cloud.callFunction({
      name: 'answer',
      config: { timeout: 90000 },
      data: { action: 'generateVariants', questionIds: ids, count },
      success: (res) => {
        const result = res.result || {};
        if (result.success && result.data && (result.data.variants || []).length) {
          const sources = result.data.sources || [];
          const variants = result.data.variants.map((v, i) => {
            const src = sources.find((s) => s.index === v.sourceIndex);
            return {
              ...v,
              index: i + 1,
              selected: true,
              showAnswer: false,
              difficultyText: DIFFICULTY_TEXT[v.difficulty] || '中等',
              difficultyClass: DIFFICULTY_CLASS[v.difficulty] || 'medium',
              sourceLabel: v.isExtra ? '综合加练' : (src ? `对应第 ${src.index} 题` : `对应第 ${v.sourceIndex} 题`),
              sourcePreview: src ? src.preview : ''
            };
          });
          this.setData({
            stage: 'result',
            variants,
            selectedCount: variants.length,
            sourceQuestionIds: result.data.sourceQuestionIds || ids,
            category: (result.data.categories || [])[0] || ''
          });
        } else {
          this.setData({ stage: 'error', error: result.error || '生成失败，请返回重试' });
        }
      },
      fail: () => this.setData({ stage: 'error', error: '网络异常，请返回重试' })
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
      selectedCount: variants.filter((v) => v.selected).length
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
    const chosen = this.data.variants.filter((v) => v.selected);
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
        variants: chosen.map((v) => ({
          content: v.content,
          answer: v.answer,
          analysis: v.analysis,
          difficulty: v.difficulty,
          knowledgePoint: v.knowledgePoint,
          sourceQuestionId: v.sourceQuestionId || ''
        })),
        sourceQuestionIds: this.data.sourceQuestionIds,
        category: this.data.category
      },
      success: (res) => {
        const result = res.result || {};
        if (result.success && result.data && result.data.savedCount > 0) {
          this.setData({ saved: true });
          wx.showToast({ title: `已保存 ${result.data.savedCount} 道`, icon: 'success' });
          setTimeout(() => wx.redirectTo({ url: '/pages/variantList/variantList' }), 1200);
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
