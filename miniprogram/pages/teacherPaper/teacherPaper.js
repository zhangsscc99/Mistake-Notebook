const { callTeacher, formatDay } = require('../../utils/teacher');

function pickIds() {
  const app = getApp();
  const pick = app.globalData.teacherPick || {};
  return Array.isArray(pick.questionIds) ? pick.questionIds : [];
}

Page({
  data: {
    classes: [],
    selectedClass: {},
    papers: [],
    notebooks: [],
    assignments: [],
    pickCount: 0
  },

  onLoad(options) {
    if (options && options.fromPick === '1') {
      this.setData({ pickCount: pickIds().length });
    }
    this.boot();
  },
  onShow() {
    this.setData({ pickCount: pickIds().length });
  },
  onPullDownRefresh() { this.reload().finally(() => wx.stopPullDownRefresh()); },

  async boot() {
    const dash = await callTeacher('dashboard');
    const classes = (dash.success && dash.data && dash.data.classes) || [];
    const pick = getApp().globalData.teacherPick || {};
    const selectedClass = classes.find((c) => c.id === pick.classId) || classes[0] || {};
    this.setData({ classes, selectedClass });
    await this.reload();
  },

  async reload() {
    const classId = this.data.selectedClass.id;
    const [papers, notebooks, assignments] = await Promise.all([
      callTeacher('listPapers', { classId }),
      callTeacher('listNotebooks', { classId }),
      callTeacher('teacherAssignments')
    ]);
    const list = (assignments.success && assignments.data) || [];
    this.setData({
      papers: ((papers.success && papers.data) || []).map((p) => ({ ...p, createdAt: formatDay(p.createdAt) })),
      notebooks: ((notebooks.success && notebooks.data) || []).map((n) => ({ ...n, createdAt: formatDay(n.createdAt) })),
      assignments: (classId ? list.filter((a) => a.classId === classId) : list).map((a) => ({
        ...a,
        questionCount: (a.questionIds || []).length
      }))
    });
  },

  selectClass(e) {
    const item = this.data.classes.find((c) => c.id === e.currentTarget.dataset.id);
    if (!item) return;
    this.setData({ selectedClass: item });
    this.reload();
  },

  goPick() {
    wx.reLaunch({ url: '/pages/teacherQuestions/teacherQuestions?pick=1' });
  },

  jumpStat(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'assignments') {
      this.openAssignments();
      return;
    }
    const selector = key === 'notebooks' ? '#section-notebooks' : '#section-papers';
    wx.pageScrollTo({ selector: selector, duration: 280 });
  },

  openSet(e) {
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type || 'paper';
    if (!id) return;
    wx.navigateTo({
      url: `/pages/teacherSetDetail/teacherSetDetail?type=${type}&id=${id}`
    });
  },

  openAssignments() {
    wx.navigateTo({ url: '/pages/teacherAssignments/teacherAssignments' });
  },

  openAssignment(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return this.openAssignments();
    wx.navigateTo({ url: '/pages/teacherAssignmentDetail/teacherAssignmentDetail?id=' + id });
  },

  async askTitle(label) {
    return await new Promise((resolve) => wx.showModal({
      title: label,
      editable: true,
      placeholderText: '例如：周测错题卷',
      confirmText: '确定',
      success: (r) => resolve(r.confirm ? (r.content || '').trim() : '')
    }));
  },

  requirePick() {
    const ids = pickIds();
    if (!this.data.selectedClass.id) {
      wx.showToast({ title: '请先选择班级', icon: 'none' });
      return null;
    }
    if (!ids.length) {
      wx.showToast({ title: '请先选题', icon: 'none' });
      return null;
    }
    return ids;
  },

  async savePaper() {
    const ids = this.requirePick();
    if (!ids) return;
    const title = await this.askTitle('试卷名称');
    if (!title) return;
    const r = await callTeacher('savePaper', { classId: this.data.selectedClass.id, title, questionIds: ids });
    wx.showToast({ title: r.success ? '试卷已保存' : (r.error || '保存失败'), icon: r.success ? 'success' : 'none' });
    if (r.success) this.reload();
  },

  async publishNotebook() {
    const ids = this.requirePick();
    if (!ids) return;
    const title = await this.askTitle('错题本名称');
    if (!title) return;
    const r = await callTeacher('publishNotebook', { classId: this.data.selectedClass.id, title, questionIds: ids });
    wx.showToast({ title: r.success ? '已推送给班级' : (r.error || '发布失败'), icon: r.success ? 'success' : 'none' });
    if (r.success) this.reload();
  },

  createHomework() {
    const classId = this.data.selectedClass.id || '';
    const source = pickIds().length ? 'pick' : 'hot';
    wx.navigateTo({
      url: `/pages/teacherAssignmentCreate/teacherAssignmentCreate?source=${source}&classId=${classId}`
    });
  }
});
