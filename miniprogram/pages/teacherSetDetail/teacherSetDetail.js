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
    questions: [],
    ready: false,
    recalling: false
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
    this.setData({ loading: true, ready: false });
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
        questions,
        ready: true
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

  recallSet() {
    if (this.data.recalling || !this.data.id) return;
    const isNotebook = this.data.type === 'notebook';
    wx.showModal({
      title: isNotebook ? '撤回练习' : '撤回题单',
      content: isNotebook
        ? '学生将立刻看不到这份练习。题目不会删除。'
        : '题单会从档案里拿掉。题目不会删除，需要时可以重新组卷。',
      confirmText: '撤回',
      confirmColor: '#e11d48',
      success: (res) => {
        if (res.confirm) this.doRecall(isNotebook);
      }
    });
  },

  async doRecall(isNotebook) {
    if (this.data.recalling) return;
    this.setData({ recalling: true });
    try {
      const action = isNotebook ? 'deleteNotebook' : 'deletePaper';
      const r = await callTeacher(action, { id: this.data.id });
      if (!r.success) throw new Error(r.error || '撤回失败');
      wx.showToast({ title: '已撤回', icon: 'success' });
      setTimeout(() => {
        const pages = getCurrentPages();
        if (pages.length > 1) wx.navigateBack();
        else wx.reLaunch({ url: '/pages/teacherPaper/teacherPaper' });
      }, 400);
    } catch (e) {
      wx.showToast({ title: e.message || '撤回失败', icon: 'none' });
      this.setData({ recalling: false });
    }
  }
});
