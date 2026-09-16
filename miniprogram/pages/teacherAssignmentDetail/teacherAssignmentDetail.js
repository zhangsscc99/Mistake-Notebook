const { callTeacher, formatDay } = require('../../utils/teacher');

function filterRoster(roster, keyword) {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) return roster || [];
  return (roster || []).filter((s) => String(s.nickName || '').toLowerCase().indexOf(kw) >= 0);
}

Page({
  data: {
    loading: true,
    id: '',
    title: '',
    className: '',
    dueText: '',
    studentCount: 0,
    submitted: 0,
    missing: 0,
    graded: 0,
    questions: [],
    roster: [],
    visibleRoster: [],
    keyword: '',
    showRosterSearch: false,
    gradeOpen: false,
    gradeStudent: {},
    gradeItems: [],
    gradeScore: '',
    grading: false
  },

  onLoad(options) {
    this.setData({ id: (options && options.id) || '' });
    this.load();
  },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },

  async load() {
    const id = this.data.id;
    if (!id) {
      this.setData({ loading: false });
      return wx.showToast({ title: '缺少作业', icon: 'none' });
    }
    this.setData({ loading: true });
    try {
      const r = await callTeacher('assignmentDetail', { assignmentId: id });
      if (!r.success) throw new Error(r.error || '加载失败');
      const d = r.data || {};
      const questions = (d.questions || []).map((q, i) => ({ ...q, index: i + 1 }));
      const roster = d.roster || [];
      this.setData({
        title: d.title || '作业',
        className: d.className || '',
        dueText: d.dueAt ? formatDay(d.dueAt) : '未设截止',
        studentCount: d.studentCount || 0,
        submitted: d.submitted || 0,
        missing: d.missing || 0,
        graded: d.graded || 0,
        questions,
        roster,
        visibleRoster: filterRoster(roster, this.data.keyword),
        showRosterSearch: roster.length > 8
      });
      wx.setNavigationBarTitle({ title: d.title || '作业详情' });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  openQuestion(e) {
    const q = this.data.questions[e.currentTarget.dataset.index];
    if (!q) return;
    wx.showModal({ title: `第 ${q.index} 题`, content: q.content || '', showCancel: false });
  },

  onSearch(e) {
    const keyword = e.detail.value || '';
    this.setData({
      keyword,
      visibleRoster: filterRoster(this.data.roster, keyword)
    });
  },

  clearSearch() {
    this.setData({
      keyword: '',
      visibleRoster: this.data.roster
    });
  },

  openStudent(e) {
    const studentId = e.currentTarget.dataset.id;
    const s = this.data.roster.find((x) => x.studentId === studentId);
    if (!s) return;
    if (s.statusKey === 'missing') {
      return wx.showToast({ title: '该生尚未提交', icon: 'none' });
    }
    const gradeItems = this.data.questions.map((q, i) => ({
      index: q.index,
      content: q.content || '',
      answer: String((s.answers && s.answers[i]) || '')
    }));
    this.setData({
      gradeOpen: true,
      gradeStudent: s,
      gradeItems,
      gradeScore: s.score == null ? '' : String(s.score)
    });
  },

  noop() {},
  closeGrade() {
    if (this.data.grading) return;
    this.setData({ gradeOpen: false });
  },
  onScore(e) {
    this.setData({ gradeScore: e.detail.value || '' });
  },

  async confirmGrade() {
    const s = this.data.gradeStudent || {};
    if (!s.submissionId || this.data.grading) return;
    const score = Number(this.data.gradeScore);
    if (Number.isNaN(score) || score < 0) {
      return wx.showToast({ title: '请输入有效分数', icon: 'none' });
    }
    this.setData({ grading: true });
    try {
      const g = await callTeacher('gradeAssignment', { submissionId: s.submissionId, score });
      if (!g.success) throw new Error(g.error || '批改失败');
      wx.showToast({ title: '已批改', icon: 'success' });
      this.setData({ gradeOpen: false });
      this.load();
    } catch (e) {
      wx.showToast({ title: e.message || '批改失败', icon: 'none' });
    } finally {
      this.setData({ grading: false });
    }
  }
});
