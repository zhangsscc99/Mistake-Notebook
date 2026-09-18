const { callTeacher, shortText } = require('../../utils/teacher');

Page({
  data: {
    classes: [],
    selectedClass: {},
    title: '',
    dueDate: '',
    kind: 'practice',
    pickCount: 0,
    cart: [],
    submitting: false
  },

  onLoad(options) {
    const kind = (options && options.mode) === 'homework' ? 'homework' : 'practice';
    this._preferClassId = (options && options.classId) || '';
    this._paperId = (options && options.paperId) || '';
    this.setData({ kind });
    this.boot();
  },

  async boot() {
    const dash = await callTeacher('dashboard');
    const classes = (dash.success && dash.data && dash.data.classes) || [];
    const selectedClass = classes.find((c) => c.id === this._preferClassId) || classes[0] || {};
    this.setData({ classes, selectedClass });
    await this.loadPaper();
  },

  async loadPaper() {
    const paperId = this._paperId;
    if (!paperId) {
      this.setData({ cart: [], pickCount: 0 });
      return;
    }
    const r = await callTeacher('paperDetail', { id: paperId });
    if (!r.success) {
      wx.showToast({ title: r.error || '试卷加载失败', icon: 'none' });
      this.setData({ cart: [], pickCount: 0 });
      return;
    }
    const d = r.data || {};
    const cart = (d.questions || []).map((q, i) => ({
      id: q.id,
      index: i + 1,
      content: shortText(q.content, 42),
      category: q.category || '未分类',
      sourceLabel: q.source === 'teacher_bank' ? '题库' : '错题'
    }));
    const patch = { cart, pickCount: cart.length };
    if (!this.data.title && d.title) patch.title = d.title;
    this.setData(patch);
  },

  selectClass(e) {
    const item = this.data.classes.find((c) => c.id === e.currentTarget.dataset.id);
    if (!item) return;
    this.setData({ selectedClass: item });
  },

  setKind(e) {
    const kind = e.currentTarget.dataset.kind;
    if (kind === this.data.kind) return;
    this.setData({ kind });
  },

  onTitle(e) { this.setData({ title: e.detail.value }); },
  onDue(e) { this.setData({ dueDate: e.detail.value }); },
  clearDue() { this.setData({ dueDate: '' }); },

  goPaper() {
    wx.reLaunch({ url: '/pages/teacherPaper/teacherPaper' });
  },

  async submit() {
    if (this.data.submitting) return;
    const classId = this.data.selectedClass.id;
    if (!classId) return wx.showToast({ title: '请先选择班级', icon: 'none' });
    const paperId = this._paperId;
    if (!paperId) return wx.showToast({ title: '请打开一份试卷再发给班级', icon: 'none' });
    const isHomework = this.data.kind === 'homework';
    const title = (this.data.title || '').trim() || (isHomework ? '班级作业' : '班级练习');
    this.setData({ submitting: true });
    try {
      if (isHomework) {
        const r = await callTeacher('createAssignment', {
          classId,
          title,
          dueAt: this.data.dueDate || '',
          paperId
        });
        if (!r.success) throw new Error(r.error || '发送失败');
        wx.showToast({ title: '作业已发给班级', icon: 'success' });
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/teacherAssignmentDetail/teacherAssignmentDetail?id=' + r.data.id });
        }, 400);
      } else {
        const r = await callTeacher('publishNotebook', {
          classId,
          title,
          paperId
        });
        if (!r.success) throw new Error(r.error || '发送失败');
        wx.showToast({ title: '练习已发给班级', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 400);
      }
    } catch (e) {
      wx.showToast({ title: e.message || '发送失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
