const { callTeacher, formatDay } = require('../../utils/teacher');

Page({
  data: {
    loading: true,
    title: '',
    kindLabel: '',
    meta: '',
    questions: []
  },

  onLoad(options) {
    const type = options && options.type === 'notebook' ? 'notebook' : 'paper';
    const id = (options && options.id) || '';
    this.load(type, id);
  },

  async load(type, id) {
    if (!id) {
      this.setData({ loading: false, title: '未找到' });
      return;
    }
    this.setData({ loading: true });
    try {
      const action = type === 'notebook' ? 'notebookDetail' : 'paperDetail';
      const r = await callTeacher(action, { id });
      if (!r.success) throw new Error(r.error || '加载失败');
      const d = r.data || {};
      const questions = (d.questions || []).map((q, i) => ({
        ...q,
        index: i + 1
      }));
      this.setData({
        title: d.title || (type === 'notebook' ? '班级错题本' : '班级试卷'),
        kindLabel: type === 'notebook' ? '已推送给学生' : '仅老师可见的题单',
        meta: `${questions.length} 道题 · ${formatDay(d.createdAt) || ''}`,
        questions
      });
      wx.setNavigationBarTitle({
        title: type === 'notebook' ? '错题本' : '试卷'
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ title: '加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
