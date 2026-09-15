const { callTeacher, formatDay, shortText } = require('../../utils/teacher');

function decorateReport(raw) {
  const r = raw || {};
  const students = (r.students || []).map((s) => ({
    ...s,
    scoreText: s.averageScore == null ? '待批改' : (s.averageScore + '分'),
    weakText: s.weak ? ('薄弱：' + s.weak) : '暂无错题分类'
  }));
  const catTotal = (r.byCategory || []).reduce((n, c) => n + (c.count || 0), 0);
  const byCategory = (r.byCategory || []).map((c) => ({
    ...c,
    pct: c.pct || (catTotal ? Math.round((c.count * 100) / catTotal) : 0)
  }));
  const hot = (r.hot || []).map((h, i) => ({
    ...h,
    key: i + '-' + (h.category || ''),
    preview: shortText(h.content, 36)
  }));
  return {
    id: r.id || r._id || '',
    title: r.title || '学习情况报告',
    classId: r.classId || '',
    className: r.className || '',
    createdText: formatDay(r.createdAt) || '',
    studentCount: r.studentCount || students.length,
    questionTotal: r.questionTotal || 0,
    assignmentCount: r.assignmentCount || 0,
    classAverageText: r.classAverage == null ? '—' : (r.classAverage + '分'),
    byCategory,
    hot,
    students
  };
}

function buildCopyText(report) {
  const lines = [
    `【${report.title}】`,
    report.createdText,
    `学生 ${report.studentCount} 人 · 错题 ${report.questionTotal} 道 · 作业 ${report.assignmentCount} 份 · 班级均分 ${report.classAverageText}`,
    ''
  ];
  if (report.byCategory.length) {
    lines.push('学科分布：' + report.byCategory.map((c) => `${c.name} ${c.count}`).join('、'));
    lines.push('');
  }
  if (report.hot.length) {
    lines.push('高频错题：');
    report.hot.forEach((h, i) => {
      lines.push(`${i + 1}. [${h.category}] ${h.preview}（${h.count}次 / ${h.studentCount}人）`);
    });
    lines.push('');
  }
  lines.push('学生情况：');
  if (!report.students.length) lines.push('暂无学生');
  report.students.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.nickName}  错题${s.questionCount}道  作业已交${s.submitted}  均分${s.scoreText}  ${s.weakText}`);
  });
  lines.push('');
  lines.push('——来自智卷错题通教师工作台');
  return lines.join('\n');
}

Page({
  data: {
    classes: [],
    selectedClass: {},
    generating: false,
    report: null,
    history: []
  },

  onLoad(options) {
    this._preferClassId = (options && options.classId) || '';
    this.boot();
  },
  onPullDownRefresh() {
    this.loadHistory().finally(() => wx.stopPullDownRefresh());
  },

  async boot() {
    const dash = await callTeacher('dashboard');
    const classes = (dash.success && dash.data && dash.data.classes) || [];
    const selectedClass = classes.find((c) => c.id === this._preferClassId) || classes[0] || {};
    this.setData({ classes, selectedClass });
    await this.loadHistory(true);
  },

  async loadHistory(autoOpen) {
    const classId = this.data.selectedClass.id;
    if (!classId) {
      this.setData({ history: [], report: null });
      return;
    }
    const r = await callTeacher('listParentReports', { classId });
    const history = ((r.success && r.data) || []).map((p) => ({
      ...p,
      createdText: formatDay(p.createdAt)
    }));
    this.setData({ history });
    if (autoOpen && history[0]) await this.showReport(history[0].id, true);
  },

  selectClass(e) {
    const item = this.data.classes.find((c) => c.id === e.currentTarget.dataset.id);
    if (!item) return;
    this.setData({ selectedClass: item, report: null });
    this.loadHistory(true);
  },

  async generate() {
    const classId = this.data.selectedClass.id;
    if (!classId) return wx.showToast({ title: '请先选择班级', icon: 'none' });
    if (this.data.generating) return;
    this.setData({ generating: true });
    try {
      const r = await callTeacher('parentReport', { classId }, 20000);
      if (!r.success) throw new Error(r.error || '生成失败');
      this.setData({ report: decorateReport(r.data) });
      await this.loadHistory(false);
      wx.showToast({ title: '报告已生成', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || '生成失败', icon: 'none' });
    } finally {
      this.setData({ generating: false });
    }
  },

  openHistory(e) {
    this.showReport(e.currentTarget.dataset.id, false);
  },

  async showReport(id, silent) {
    if (!id) return;
    if (!silent) wx.showLoading({ title: '加载报告', mask: true });
    try {
      const r = await callTeacher('parentReportDetail', { id });
      if (!silent) wx.hideLoading();
      if (!r.success) throw new Error(r.error || '加载失败');
      this.setData({ report: decorateReport(r.data) });
    } catch (err) {
      if (!silent) wx.hideLoading();
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  copyReport() {
    if (!this.data.report) return;
    wx.setClipboardData({
      data: buildCopyText(this.data.report),
      success: () => wx.showToast({ title: '已复制，可发给家长', icon: 'success' })
    });
  },

  openStudent(e) {
    const studentId = e.currentTarget.dataset.id;
    const classId = (this.data.report && this.data.report.classId) || this.data.selectedClass.id;
    if (!studentId || !classId) return;
    wx.navigateTo({
      url: `/pages/teacherStudent/teacherStudent?classId=${classId}&studentId=${studentId}`
    });
  }
});
