const { callTeacher, formatDay } = require('../../utils/teacher');

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
    roster: []
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
      this.setData({
        title: d.title || '作业',
        className: d.className || '',
        dueText: d.dueAt ? formatDay(d.dueAt) : '未设截止',
        studentCount: d.studentCount || 0,
        submitted: d.submitted || 0,
        missing: d.missing || 0,
        graded: d.graded || 0,
        questions,
        roster: d.roster || []
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

  openStudent(e) {
    const studentId = e.currentTarget.dataset.id;
    const s = this.data.roster.find((x) => x.studentId === studentId);
    if (!s) return;
    if (s.statusKey === 'missing') {
      return wx.showToast({ title: '该生尚未提交', icon: 'none' });
    }
    const answers = (s.answers || []).map((a, i) => `${i + 1}. ${a || '（空）'}`).join('\n');
    wx.showModal({
      title: s.nickName,
      content: `${s.status}\n\n作答：\n${answers || '无'}`,
      editable: true,
      placeholderText: '输入分数后确认批改',
      confirmText: '批改',
      success: async (x) => {
        if (!x.confirm) return;
        if (!s.submissionId) return;
        const g = await callTeacher('gradeAssignment', { submissionId: s.submissionId, score: x.content });
        wx.showToast({ title: g.success ? '已批改' : (g.error || '批改失败'), icon: g.success ? 'success' : 'none' });
        if (g.success) this.load();
      }
    });
  }
});
