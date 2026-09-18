const { callTeacher, defaultDateRange } = require('../../utils/teacher');
const { partitionPaperQuestions, promptPaperTitle } = require('../../utils/paper.js');

function unpackBank(res) {
  const data = (res && res.success && res.data) || {};
  if (Array.isArray(data)) return { questions: data, hasMore: false };
  return {
    questions: Array.isArray(data.questions) ? data.questions : [],
    hasMore: !!data.hasMore
  };
}

function decorateQuestions(questions, hot) {
  const byId = {};
  (hot || []).forEach((h) => {
    (h.questionIds || []).concat(h.questionId ? [h.questionId] : []).forEach((id) => {
      if (id) byId[id] = h;
    });
  });
  return (questions || []).map((q) => {
    const id = String(q.id || q._id || '');
    const h = byId[id] || byId[q.id];
    return {
      ...q,
      id,
      aiAnswer: q.aiAnswer || q.answer || '',
      aiAnalysis: q.aiAnalysis || q.analysis || '',
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
    bankCount: 0,
    sourceFilter: 'mistakes',
    mistakeQuestions: [],
    bankQuestions: [],
    picking: false,
    selectedMap: {},
    selectedCount: 0,
    fromDate: '',
    toDate: '',
    today: '',
    mistakeHasMore: false,
    bankHasMore: false,
    loadingMore: false
  },

  onLoad(options) {
    const picking = !!(options && options.pick === '1');
    const sourceFilter = options && options.bank === '1' ? 'bank' : 'mistakes';
    this._preferClassId = (options && options.classId) || '';
    this._paperId = (options && options.paperId) || '';
    this._fromPaper = (options && options.from) === 'paper' || !!this._paperId;
    const range = defaultDateRange();
    this.setData({
      picking,
      sourceFilter,
      fromDate: range.from,
      toDate: range.to,
      today: range.today
    });
    this.boot();
  },
  onShow() {
    if (this._ready) this.reload();
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
    const pick = getApp().globalData.teacherPick || {};
    const selectedClass = classes.find((c) => c.id === this._preferClassId)
      || classes.find((c) => c.id === pick.classId)
      || classes[0]
      || {};
    this.setData({ classes, selectedClass });
    await this.reload();
    this._ready = true;
  },

  syncView(patch) {
    const next = Object.assign({}, this.data, patch || {});
    const sourceFilter = next.sourceFilter || 'mistakes';
    const pool = sourceFilter === 'bank' ? (next.bankQuestions || []) : (next.mistakeQuestions || []);
    const studentId = sourceFilter === 'bank' ? '' : next.studentId;
    const onlyHot = sourceFilter === 'bank' ? false : next.onlyHot;
    const visibleQuestions = filterQuestions(pool, {
      category: next.category,
      studentId,
      keyword: next.keyword,
      onlyHot
    });
    const visibleAllSelected = visibleQuestions.length > 0
      && visibleQuestions.every((q) => next.selectedMap[q.id]);
    const catMap = {};
    pool.forEach((q) => {
      const name = q.category || '未分类';
      catMap[name] = (catMap[name] || 0) + 1;
    });
    const categoryChips = [{ name: '全部', value: '', count: pool.length }].concat(
      Object.keys(catMap).map((name) => ({ name, value: name, count: catMap[name] }))
    );
    this.setData(Object.assign({}, patch, {
      sourceFilter,
      questions: pool,
      visibleQuestions,
      visibleCount: visibleQuestions.length,
      visibleAllSelected,
      onlyHot,
      studentId,
      categoryChips,
      studentLabel: studentLabelOf(next.students, studentId),
      compactStudentFilter: sourceFilter !== 'bank' && (next.students || []).length > STUDENT_CHIP_LIMIT
    }));
  },

  async reload() {
    const classId = this.data.selectedClass.id;
    this.setData({ loading: true });
    try {
      const range = { from: this.data.fromDate, to: this.data.toDate };
      const bankP = callTeacher('listBank', { from: range.from, to: range.to, skip: 0 });
      if (!classId) {
        const bank = await bankP;
        const bankPack = unpackBank(bank);
        const bankQuestions = bankPack.questions.map((q) => ({
          ...q,
          isHot: false,
          hotCount: 0,
          hotStudents: 0
        }));
        this.syncView({
          mistakeQuestions: [],
          bankQuestions,
          questions: bankQuestions,
          students: [],
          compactStudentFilter: false,
          studentLabel: '全班',
          stats: { total: 0, hot: [], studentCount: 0, byCategory: [] },
          hotCount: 0,
          bankCount: bankQuestions.length,
          mistakeHasMore: false,
          bankHasMore: bankPack.hasMore
        });
        return;
      }
      const [qs, st, stu, bank] = await Promise.all([
        callTeacher('teacherQuestions', { classId, from: range.from, to: range.to, skip: 0 }),
        callTeacher('classStats', { classId, from: range.from, to: range.to }),
        callTeacher('students', { classId }),
        bankP
      ]);
      const stats = (st.success && st.data) || { total: 0, hot: [], studentCount: 0, byCategory: [] };
      const mistakeQuestions = decorateQuestions((qs.success && qs.data && qs.data.questions) || [], stats.hot);
      const bankPack = unpackBank(bank);
      const bankQuestions = bankPack.questions.map((q) => ({
        ...q,
        isHot: false,
        hotCount: 0,
        hotStudents: 0
      }));
      const students = ((stu.success && stu.data) || []).map((s) => ({
        id: s.id,
        name: s.nickName || '未设置昵称',
        questionCount: s.questionCount || 0
      }));
      this.syncView({
        mistakeQuestions,
        bankQuestions,
        stats,
        hotCount: (stats.hot || []).length,
        bankCount: bankQuestions.length,
        students,
        mistakeHasMore: !!(qs.success && qs.data && qs.data.hasMore),
        bankHasMore: bankPack.hasMore
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

  showMistakes() {
    if (this.data.sourceFilter === 'mistakes') return;
    this.syncView({ sourceFilter: 'mistakes', category: '', onlyHot: false });
  },

  showBank() {
    if (this.data.sourceFilter === 'bank') return;
    this.syncView({ sourceFilter: 'bank', category: '', studentId: '', onlyHot: false });
  },

  goCapture() {
    wx.reLaunch({ url: '/pages/teacherCapture/teacherCapture' });
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

  async loadMore() {
    if (this.data.loadingMore) return;
    const classId = this.data.selectedClass.id;
    const isBank = this.data.sourceFilter === 'bank';
    if (isBank ? !this.data.bankHasMore : (!classId || !this.data.mistakeHasMore)) return;
    this.setData({ loadingMore: true });
    try {
      const range = { from: this.data.fromDate, to: this.data.toDate };
      if (isBank) {
        const r = await callTeacher('listBank', {
          from: range.from,
          to: range.to,
          skip: this.data.bankQuestions.length
        });
        const pack = unpackBank(r);
        const extra = pack.questions.map((q) => ({
          ...q,
          isHot: false,
          hotCount: 0,
          hotStudents: 0
        }));
        this.syncView({
          bankQuestions: this.data.bankQuestions.concat(extra),
          bankHasMore: pack.hasMore
        });
      } else {
        const r = await callTeacher('teacherQuestions', {
          classId,
          from: range.from,
          to: range.to,
          skip: this.data.mistakeQuestions.length
        });
        const extra = decorateQuestions((r.success && r.data && r.data.questions) || [], this.data.stats.hot);
        this.syncView({
          mistakeQuestions: this.data.mistakeQuestions.concat(extra),
          mistakeHasMore: !!(r.success && r.data && r.data.hasMore)
        });
      }
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  startPick() { this.syncView({ picking: true }); },
  cancelPick() {
    if (this._paperId) {
      wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/teacherPaper/teacherPaper' }) });
      return;
    }
    if (this._fromPaper) {
      wx.reLaunch({ url: '/pages/teacherPaper/teacherPaper' });
      return;
    }
    this.syncView({ picking: false, selectedMap: {}, selectedCount: 0 });
  },

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
      if (!q) return;
      if (this.data.sourceFilter === 'bank') {
        wx.showModal({
          title: q.category || '老师题库',
          content: q.content || '',
          confirmText: '删除',
          confirmColor: '#e11d48',
          cancelText: '关闭',
          success: (r) => {
            if (r.confirm) this.deleteBank(id);
          }
        });
        return;
      }
      const extra = [
        q.nickName ? `来自：${q.nickName}` : '',
        q.isHot ? `班级高频 ${q.hotCount} 次 / ${q.hotStudents} 人` : ''
      ].filter(Boolean).join('\n');
      wx.showModal({
        title: q.category || '学生错题',
        content: `${q.content || ''}${extra ? `\n\n${extra}` : ''}`,
        showCancel: false
      });
      return;
    }
    const map = Object.assign({}, this.data.selectedMap);
    if (map[id]) delete map[id];
    else map[id] = true;
    this.syncView({ selectedMap: map, selectedCount: Object.keys(map).length });
  },

  async deleteBank(id) {
    const r = await callTeacher('deleteBankQuestion', { id });
    if (!r.success) return wx.showToast({ title: r.error || '删除失败', icon: 'none' });
    wx.showToast({ title: '已删除', icon: 'success' });
    const map = Object.assign({}, this.data.selectedMap);
    delete map[id];
    this.setData({ selectedMap: map, selectedCount: Object.keys(map).length });
    this.reload();
  },

  confirmPick() {
    const ids = Object.keys(this.data.selectedMap);
    if (!ids.length) return wx.showToast({ title: '请先选题', icon: 'none' });
    const pool = (this.data.mistakeQuestions || []).concat(this.data.bankQuestions || []);
    const picked = pool.filter((q) => this.data.selectedMap[String(q.id)]);
    const { ready, blocked } = partitionPaperQuestions(picked, true);
    if (!ready.length) {
      wx.showToast({ title: blocked.length ? '未解析完成的题目不能加入组卷' : '请先选题', icon: 'none' });
      return;
    }
    if (blocked.length) {
      wx.showToast({ title: `已跳过${blocked.length}道未解析题`, icon: 'none' });
    }
    const questionIds = ready.map((q) => q.id);
    const paperId = this._paperId;
    const goDone = (toast) => {
      if (paperId) {
        wx.navigateBack({
          success: () => wx.showToast({ title: toast, icon: 'success' }),
          fail: () => wx.redirectTo({
            url: '/pages/teacherSetDetail/teacherSetDetail?type=paper&id=' + paperId,
            success: () => wx.showToast({ title: toast, icon: 'success' })
          })
        });
      } else {
        wx.reLaunch({
          url: '/pages/teacherPaper/teacherPaper',
          success: () => wx.showToast({ title: toast, icon: 'success' })
        });
      }
    };
    if (paperId) {
      wx.showLoading({ title: '保存中...', mask: true });
      callTeacher('updatePaper', { id: paperId, questionIds })
        .then((r) => {
          wx.hideLoading();
          if (!r.success) return wx.showToast({ title: r.error || '保存失败', icon: 'none' });
          goDone('已加入试卷');
        })
        .catch(() => {
          wx.hideLoading();
          wx.showToast({ title: '保存失败', icon: 'none' });
        });
      return;
    }
    const defaultTitle = '练习卷';
    promptPaperTitle(defaultTitle)
      .then((title) => {
        wx.showLoading({ title: '保存中...', mask: true });
        return callTeacher('savePaper', { title, questionIds });
      })
      .then((r) => {
        wx.hideLoading();
        if (!r.success) return wx.showToast({ title: r.error || '保存失败', icon: 'none' });
        goDone('试卷保存成功');
      })
      .catch((err) => {
        wx.hideLoading();
        if (err && (err.message === 'cancelled' || err.message === 'empty_title')) return;
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
  }
});
