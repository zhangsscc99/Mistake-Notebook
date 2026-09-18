const { callTeacher, formatDay, shortText, defaultDateRange } = require('../../utils/teacher');
const { partitionPaperQuestions } = require('../../utils/paper.js');

function readPick() {
  return getApp().globalData.teacherPick || {};
}

function pickIds() {
  const ids = readPick().questionIds;
  return Array.isArray(ids) ? ids : [];
}

function writePick(next) {
  getApp().globalData.teacherPick = next && next.questionIds && next.questionIds.length
    ? next
    : null;
}

function decorateCart(questions) {
  return (questions || []).map((q, i) => ({
    ...q,
    index: i + 1,
    content: shortText(q.content, 52),
    category: q.category || '未分类',
    sourceLabel: q.source === 'teacher_bank' ? '题库' : '错题'
  }));
}

Page({
  data: {
    classes: [],
    selectedClass: {},
    papers: [],
    notebooks: [],
    assignments: [],
    pickCount: 0,
    cart: [],
    cartLoading: false,
    cartBelongsHere: true,
    fromDate: '',
    toDate: '',
    today: ''
  },

  onLoad() {
    this.boot();
  },
  onShow() {
    if (this._ready) {
      this.loadCart();
      this.reload();
    }
  },
  onPullDownRefresh() { this.reload().finally(() => wx.stopPullDownRefresh()); },

  async boot() {
    const dash = await callTeacher('dashboard');
    const classes = (dash.success && dash.data && dash.data.classes) || [];
    const pick = readPick();
    const selectedClass = classes.find((c) => c.id === pick.classId) || classes[0] || {};
    const range = defaultDateRange();
    this.setData({
      classes,
      selectedClass,
      fromDate: range.from,
      toDate: range.to,
      today: range.today
    });
    await Promise.all([this.loadCart(), this.reload()]);
    this._ready = true;
  },

  async loadCart() {
    const pick = readPick();
    const ids = Array.isArray(pick.questionIds) ? pick.questionIds : [];
    const classId = this.data.selectedClass.id || '';
    const cartBelongsHere = !pick.classId || !classId || pick.classId === classId;
    if (!ids.length || !cartBelongsHere) {
      this.setData({ cart: [], pickCount: cartBelongsHere ? 0 : ids.length, cartBelongsHere, cartLoading: false });
      return;
    }
    this.setData({ cartLoading: true, cartBelongsHere: true });
    const r = await callTeacher('listPickedQuestions', { questionIds: ids });
    if (!r.success) {
      this.setData({ cartLoading: false, pickCount: ids.length, cartBelongsHere: true });
      wx.showToast({ title: r.error || '题目加载失败', icon: 'none' });
      return;
    }
    const { ready, blocked } = partitionPaperQuestions(r.data || [], true);
    if (blocked.length) {
      writePick({ classId: pick.classId || classId, questionIds: ready.map((q) => q.id), paperId: ready.length ? pick.paperId : '' });
    }
    const found = decorateCart(ready);
    const foundIds = found.map((q) => q.id);
    if (foundIds.length !== ids.length) {
      writePick({ classId: pick.classId || classId, questionIds: foundIds, paperId: foundIds.length ? pick.paperId : '' });
    }
    this.setData({
      cart: found,
      pickCount: found.length,
      cartLoading: false,
      cartBelongsHere: true
    });
  },

  async reload() {
    const classId = this.data.selectedClass.id;
    const range = { from: this.data.fromDate, to: this.data.toDate };
    const [papers, notebooks, assignments] = await Promise.all([
      callTeacher('listPapers', { classId, from: range.from, to: range.to }),
      callTeacher('listNotebooks', { classId, from: range.from, to: range.to }),
      callTeacher('teacherAssignments', { from: range.from, to: range.to })
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
    this.loadCart();
    this.reload();
  },

  onFromDate(e) {
    let fromDate = e.detail.value;
    let toDate = this.data.toDate;
    if (fromDate > toDate) toDate = fromDate;
    this.setData({ fromDate, toDate }, () => this.reload());
  },

  onToDate(e) {
    let toDate = e.detail.value;
    let fromDate = this.data.fromDate;
    if (fromDate > toDate) fromDate = toDate;
    this.setData({ fromDate, toDate }, () => this.reload());
  },

  goPick() {
    const classId = this.data.selectedClass.id || '';
    wx.reLaunch({
      url: '/pages/teacherQuestions/teacherQuestions?pick=1' + (classId ? '&classId=' + classId : '')
    });
  },

  goCapture() {
    const classId = this.data.selectedClass.id || '';
    if (!classId) {
      wx.showToast({ title: '请先选择班级', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/teacherCapture/teacherCapture?classId=' + classId });
  },

  removeItem(e) {
    const id = e.currentTarget.dataset.id;
    const pick = readPick();
    const questionIds = (pick.questionIds || []).filter((x) => x !== id);
    writePick({
      classId: pick.classId || this.data.selectedClass.id,
      questionIds,
      paperId: ''
    });
    this.loadCart();
  },

  clearCart() {
    writePick(null);
    this.setData({ cart: [], pickCount: 0, cartBelongsHere: true });
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
      placeholderText: '例如：周五错题题单',
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
    if (!this.data.cartBelongsHere) {
      wx.showToast({ title: '选题属于其他班级', icon: 'none' });
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
    const { ready, blocked } = partitionPaperQuestions(this.data.cart, true);
    if (!ready.length) {
      wx.showToast({ title: blocked.length ? '未解析完成的题目不能加入组卷' : '请先选题', icon: 'none' });
      return;
    }
    const title = await this.askTitle('题单名称');
    if (!title) return;
    const r = await callTeacher('savePaper', { classId: this.data.selectedClass.id, title, questionIds: ready.map((q) => q.id) });
    wx.showToast({ title: r.success ? '题单已保存' : (r.error || '保存失败'), icon: r.success ? 'success' : 'none' });
    if (r.success) this.reload();
  },

  goSend() {
    const ids = this.requirePick();
    if (!ids) return;
    const classId = this.data.selectedClass.id;
    wx.navigateTo({
      url: `/pages/teacherAssignmentCreate/teacherAssignmentCreate?mode=practice&classId=${classId}`
    });
  }
});
