const { callTeacher } = require('../../utils/teacher');

function decorateQuestions(questions, hot) {
  const byId = {};
  (hot || []).forEach((h) => {
    (h.questionIds || []).concat(h.questionId ? [h.questionId] : []).forEach((id) => {
      if (id) byId[id] = h;
    });
  });
  return (questions || []).map((q) => {
    const h = byId[q.id];
    return {
      ...q,
      isHot: !!h,
      hotCount: h ? h.count : 0,
      hotStudents: h ? h.studentCount : 0
    };
  });
}

function filterStudents(students, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return students || [];
  return (students || []).filter((s) => String(s.name || '').toLowerCase().indexOf(q) >= 0);
}

function studentLabelOf(students, studentId) {
  if (!studentId) return '全班';
  const s = (students || []).find((x) => x.id === studentId);
  return (s && s.name) || '已选学生';
}

const STUDENT_CHIP_LIMIT = 8;

function filterQuestions(questions, opts) {
  const category = opts.category || '';
  const studentId = opts.studentId || '';
  const kw = String(opts.keyword || '').trim().toLowerCase();
  const onlyHot = !!opts.onlyHot;
  return (questions || []).filter((q) => {
    if (onlyHot && !q.isHot) return false;
    if (studentId && q.openid !== studentId) return false;
    if (category && (q.category || '未分类') !== category) return false;
    if (kw && String(q.content || '').toLowerCase().indexOf(kw) < 0) return false;
    return true;
  });
}

Page({
  data: {
    loading: true,
    classes: [],
    selectedClass: {},
    students: [],
    questions: [],
    visibleQuestions: [],
    visibleCount: 0,
    visibleAllSelected: false,
    categoryChips: [{ name: '全部', value: '', count: 0 }],
    category: '',
    studentId: '',
    studentLabel: '全班',
    compactStudentFilter: false,
    studentPickerOpen: false,
    studentQuery: '',
    pickerStudents: [],
    keyword: '',
    onlyHot: false,
    stats: { total: 0, hot: [], studentCount: 0, byCategory: [] },
    hotCount: 0,
    picking: false,
    selectedMap: {},
    selectedCount: 0
  },

  onLoad(options) {
    this.setData({ picking: options && options.pick === '1' });
    this.boot();
  },
  onPullDownRefresh() { this.reload().finally(() => wx.stopPullDownRefresh()); },

  async boot() {
    const dash = await callTeacher('dashboard');
    if (!dash.success) {
      this.setData({ loading: false });
      if (dash.error === 'NOT_TEACHER') return;
      return wx.showToast({ title: dash.error || '加载失败', icon: 'none' });
    }
    const classes = dash.data.classes || [];
    const selectedClass = classes[0] || {};
    this.setData({ classes, selectedClass });
    await this.reload();
  },

  syncView(patch) {
    const next = Object.assign({}, this.data, patch || {});
    const visibleQuestions = filterQuestions(next.questions, {
      category: next.category,
      studentId: next.studentId,
      keyword: next.keyword,
      onlyHot: next.onlyHot
    });
    const visibleAllSelected = visibleQuestions.length > 0
      && visibleQuestions.every((q) => next.selectedMap[q.id]);
    this.setData(Object.assign({}, patch, {
      visibleQuestions,
      visibleCount: visibleQuestions.length,
      visibleAllSelected,
      studentLabel: studentLabelOf(next.students, next.studentId),
      compactStudentFilter: (next.students || []).length > STUDENT_CHIP_LIMIT
    }));
  },

  async reload() {
    const classId = this.data.selectedClass.id;
    this.setData({ loading: true });
    try {
      if (!classId) {
        this.syncView({
          questions: [],
          students: [],
          compactStudentFilter: false,
          studentLabel: '全班',
          stats: { total: 0, hot: [], studentCount: 0, byCategory: [] },
          hotCount: 0,
          categoryChips: [{ name: '全部', value: '', count: 0 }]
        });
        return;
      }
      const [qs, st, stu] = await Promise.all([
        callTeacher('teacherQuestions', { classId }),
        callTeacher('classStats', { classId }),
        callTeacher('students', { classId })
      ]);
      const stats = (st.success && st.data) || { total: 0, hot: [], studentCount: 0, byCategory: [] };
      const questions = decorateQuestions((qs.success && qs.data && qs.data.questions) || [], stats.hot);
      const byCategory = stats.byCategory || [];
      const categoryChips = [{ name: '全部', value: '', count: stats.total || questions.length }].concat(
        byCategory.map((c) => ({ name: c.name, value: c.name, count: c.count }))
      );
      const students = ((stu.success && stu.data) || []).map((s) => ({
        id: s.id,
        name: s.nickName || '未设置昵称',
        questionCount: s.questionCount || 0
      }));
      this.syncView({
        questions,
        stats,
        hotCount: (stats.hot || []).length,
        categoryChips,
        students
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  selectClass(e) {
    const item = this.data.classes.find((c) => c.id === e.currentTarget.dataset.id);
    if (!item) return;
    this.setData({
      selectedClass: item,
      selectedMap: {},
      selectedCount: 0,
      category: '',
      studentId: '',
      keyword: '',
      onlyHot: false
    }, () => this.reload());
  },

  selectCategory(e) {
    const value = e.currentTarget.dataset.value || '';
    if (value === this.data.category) return;
    this.syncView({ category: value });
  },

  selectStudent(e) {
    const id = e.currentTarget.dataset.id === 'all' ? '' : (e.currentTarget.dataset.id || '');
    if (id === this.data.studentId && !this.data.studentPickerOpen) return;
    this.syncView({
      studentId: id,
      studentPickerOpen: false,
      studentQuery: ''
    });
  },

  openStudentPicker() {
    this.setData({
      studentPickerOpen: true,
      studentQuery: '',
      pickerStudents: this.data.students
    });
  },

  closeStudentPicker() {
    this.setData({ studentPickerOpen: false, studentQuery: '' });
  },

  onPickerSearch(e) {
    const studentQuery = e.detail.value || '';
    this.setData({
      studentQuery,
      pickerStudents: filterStudents(this.data.students, studentQuery)
    });
  },

  noop() {},

  onSearch(e) {
    this.syncView({ keyword: e.detail.value || '' });
  },

  clearSearch() {
    this.syncView({ keyword: '' });
  },

  toggleHot() {
    this.syncView({ onlyHot: !this.data.onlyHot });
  },

  startPick() { this.syncView({ picking: true }); },
  cancelPick() { this.syncView({ picking: false, selectedMap: {}, selectedCount: 0 }); },

  selectAllVisible() {
    const map = Object.assign({}, this.data.selectedMap);
    this.data.visibleQuestions.forEach((q) => { map[q.id] = true; });
    this.syncView({ selectedMap: map, selectedCount: Object.keys(map).length });
  },

  clearVisible() {
    const map = Object.assign({}, this.data.selectedMap);
    this.data.visibleQuestions.forEach((q) => { delete map[q.id]; });
    this.syncView({ selectedMap: map, selectedCount: Object.keys(map).length });
  },

  onQuestionTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!this.data.picking) {
      const q = this.data.questions.find((x) => x.id === id);
      if (q) {
        const extra = [
          q.nickName ? `来自：${q.nickName}` : '',
          q.isHot ? `班级高频 ${q.hotCount} 次 / ${q.hotStudents} 人` : ''
        ].filter(Boolean).join('\n');
        wx.showModal({
          title: q.category || '班级错题',
          content: `${q.content || ''}${extra ? `\n\n${extra}` : ''}`,
          showCancel: false
        });
      }
      return;
    }
    const map = Object.assign({}, this.data.selectedMap);
    if (map[id]) delete map[id];
    else map[id] = true;
    this.syncView({ selectedMap: map, selectedCount: Object.keys(map).length });
  },

  confirmPick() {
    const ids = Object.keys(this.data.selectedMap);
    if (!ids.length) return wx.showToast({ title: '请先选题', icon: 'none' });
    getApp().globalData.teacherPick = {
      classId: this.data.selectedClass.id,
      questionIds: ids
    };
    wx.reLaunch({ url: '/pages/teacherPaper/teacherPaper?fromPick=1' });
  }
});
