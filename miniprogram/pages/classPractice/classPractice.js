const { callTeacher } = require('../../utils/teacher');

Page({
  data: {
    loading: true,
    title: '',
    meta: '',
    questions: []
  },

  onLoad(options) {
    this.id = (options && options.id) || '';
    this.load();
  },

  async load() {
    if (!this.id) {
      this.setData({ loading: false, title: '未找到' });
      return;
    }
    this.setData({ loading: true });
    try {
      const r = await callTeacher('myNotebookDetail', { id: this.id });
      if (!r.success) throw new Error(r.error || '加载失败');
      const d = r.data || {};
      const questions = (d.questions || []).map((q, i) => ({
        ...q,
        index: i + 1
      }));
      this.setData({
        title: d.title || '班级练习',
        meta: `${d.className || '班级'} · ${questions.length} 道题`,
        questions
      });
      wx.setNavigationBarTitle({ title: '练习' });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ title: '加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
