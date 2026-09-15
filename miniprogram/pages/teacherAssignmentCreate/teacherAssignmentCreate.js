const { callTeacher } = require('../../utils/teacher');

function pickIds() {
  const pick = getApp().globalData.teacherPick || {};
  return Array.isArray(pick.questionIds) ? pick.questionIds : [];
}

Page({
  data: {
    classes: [],
    selectedClass: {},
    papers: [],
    selectedPaperId: '',
    title: '',
    dueDate: '',
    source: 'hot',
    pickCount: 0,
    hotCount: 0,
    submitting: false
  },

  onLoad(options) {
    const source = (options && options.source) || '';
    const classId = (options && options.classId) || '';
    const pickCount = pickIds().length;
    let nextSource = source || (pickCount ? 'pick' : 'hot');
    if (nextSource === 'pick' && !pickCount) nextSource = 'hot';
    this.setData({ source: nextSource, pickCount });
    this._preferClassId = classId;
    this.boot();
  },

  async boot() {
    const dash = await callTeacher('dashboard');
    const classes = (dash.success && dash.data && dash.data.classes) || [];
    const selectedClass = classes.find((c) => c.id === this._preferClassId) || classes[0] || {};
    this.setData({ classes, selectedClass });
    await this.reloadSources();
  },

  async reloadSources() {
    const classId = this.data.selectedClass.id;
    if (!classId) {
      this.setData({ papers: [], hotCount: 0 });
      return;
    }
    const [papers, stats] = await Promise.all([
      callTeacher('listPapers', { classId }),
      callTeacher('classStats', { classId })
    ]);
    const hot = ((stats.success && stats.data && stats.data.hot) || []);
    this.setData({
      papers: (papers.success && papers.data) || [],
      hotCount: hot.length,
      selectedPaperId: ''
    });
  },

  selectClass(e) {
    const item = this.data.classes.find((c) => c.id === e.currentTarget.dataset.id);
    if (!item) return;
    this.setData({ selectedClass: item });
    this.reloadSources();
  },

  onTitle(e) { this.setData({ title: e.detail.value }); },
  onDue(e) { this.setData({ dueDate: e.detail.value }); },
  clearDue() { this.setData({ dueDate: '' }); },

  setSource(e) {
    const source = e.currentTarget.dataset.source;
    if (source === 'pick' && !this.data.pickCount) {
      return wx.showToast({ title: '请先去错题页选题', icon: 'none' });
    }
    this.setData({ source });
  },

  selectPaper(e) {
    this.setData({ selectedPaperId: e.currentTarget.dataset.id, source: 'paper' });
  },

  goPick() {
    wx.reLaunch({ url: '/pages/teacherQuestions/teacherQuestions?pick=1' });
  },

  resolveIds() {
    const { source, papers, selectedPaperId } = this.data;
    if (source === 'pick') return pickIds();
    if (source === 'paper') {
      const p = papers.find((x) => x.id === selectedPaperId);
      return (p && p.questionIds) || [];
    }
    return [];
  },

  async submit() {
    if (this.data.submitting) return;
    const classId = this.data.selectedClass.id;
    if (!classId) return wx.showToast({ title: '请先选择班级', icon: 'none' });
    const title = (this.data.title || '').trim() || '班级作业';
    let questionIds = [];
    let paperId = '';
    if (this.data.source === 'hot') {
      const st = await callTeacher('classStats', { classId });
      const hot = (st.success && st.data && st.data.hot) || [];
      questionIds = hot.map((h) => h.questionId).filter(Boolean);
      if (!questionIds.length) return wx.showToast({ title: '还没有高频错题', icon: 'none' });
    } else if (this.data.source === 'paper') {
      paperId = this.data.selectedPaperId;
      if (!paperId) return wx.showToast({ title: '请选择一份试卷', icon: 'none' });
      questionIds = this.resolveIds();
    } else {
      questionIds = pickIds();
      if (!questionIds.length) return wx.showToast({ title: '请先去错题页选题', icon: 'none' });
    }
    this.setData({ submitting: true });
    try {
      const r = await callTeacher('createAssignment', {
        classId,
        title,
        dueAt: this.data.dueDate || '',
        questionIds,
        paperId
      });
      if (!r.success) throw new Error(r.error || '布置失败');
      wx.showToast({ title: '作业已布置', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/teacherAssignmentDetail/teacherAssignmentDetail?id=' + r.data.id });
      }, 400);
    } catch (e) {
      wx.showToast({ title: e.message || '布置失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
