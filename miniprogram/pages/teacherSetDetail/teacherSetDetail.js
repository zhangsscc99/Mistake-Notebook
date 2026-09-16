const { callTeacher, formatDay } = require('../../utils/teacher');

Page({
  data: {
    loading: true,
    type: 'paper',
    id: '',
    classId: '',
    title: '',
    kindLabel: '',
    meta: '',
    questions: []
  },

  onLoad(options) {
    const type = options && options.type === 'notebook' ? 'notebook' : 'paper';
    const id = (options && options.id) || '';
    this.setData({ type, id });
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
        classId: d.classId || '',
        title: d.title || (type === 'notebook' ? '班级练习' : '题单草稿'),
        kindLabel: type === 'notebook' ? '已发给学生的练习' : '仅老师可见的题单草稿',
        meta: `${questions.length} 道题 · ${formatDay(d.createdAt) || ''}`,
        questions
      });
      wx.setNavigationBarTitle({
        title: type === 'notebook' ? '练习' : '题单草稿'
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ title: '加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  },

  useThisSet() {
    const ids = (this.data.questions || []).map((q) => q.id).filter(Boolean);
    if (!ids.length) return wx.showToast({ title: '没有可组卷的题', icon: 'none' });
    getApp().globalData.teacherPick = {
      classId: this.data.classId,
      questionIds: ids,
      paperId: this.data.type === 'paper' ? this.data.id : ''
    };
    wx.reLaunch({ url: '/pages/teacherPaper/teacherPaper' });
  },

  async recall() {
    const isPaper = this.data.type === 'paper';
    const ok = await new Promise((resolve) => wx.showModal({
      title: isPaper ? '删除题单' : '撤回练习',
      content: isPaper ? '删除后学生本来也看不见。只是从老师的草稿列表拿掉。' : '撤回后学生在「我的班级」将看不到这份练习。',
      confirmText: isPaper ? '删除' : '撤回',
      confirmColor: '#e11d48',
      success: (r) => resolve(!!r.confirm)
    }));
    if (!ok) return;
    const action = isPaper ? 'recallPaper' : 'recallNotebook';
    const r = await callTeacher(action, { id: this.data.id });
    wx.showToast({
      title: r.success ? (isPaper ? '已删除' : '已撤回') : (r.error || '操作失败'),
      icon: r.success ? 'success' : 'none'
    });
    if (r.success) setTimeout(() => wx.navigateBack(), 500);
  }
});
