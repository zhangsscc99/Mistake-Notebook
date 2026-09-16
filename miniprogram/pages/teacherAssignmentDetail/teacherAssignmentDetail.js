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
    gradeComment: '',
    markHint: '',
    grading: false,
    recalling: false
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
    const marks = Array.isArray(s.marks) ? s.marks : [];
    const gradeItems = this.data.questions.map((q, i) => ({
      index: q.index,
      content: q.content || '',
      answer: String((s.answers && s.answers[i]) || ''),
      result: marks[i] === 'right' || marks[i] === 'wrong' ? marks[i] : ''
    }));
    this._scoreEdited = s.score != null;
    const right = gradeItems.filter((x) => x.result === 'right').length;
    this.setData({
      gradeOpen: true,
      gradeStudent: s,
      gradeItems,
      gradeScore: s.score == null ? '' : String(s.score),
      gradeComment: s.comment || '',
      markHint: right || gradeItems.some((x) => x.result) ? ('对 ' + right + ' / ' + gradeItems.length) : '每题点对或错，分数会按正确率预填'
    });
  },

  noop() {},
  closeGrade() {
    if (this.data.grading) return;
    this.setData({ gradeOpen: false });
  },
  onScore(e) {
    this._scoreEdited = true;
    this.setData({ gradeScore: e.detail.value || '' });
  },
  onComment(e) {
    this.setData({ gradeComment: e.detail.value || '' });
  },

  markQuestion(e) {
    const index = Number(e.currentTarget.dataset.index);
    const result = e.currentTarget.dataset.result;
    const gradeItems = this.data.gradeItems.slice();
    if (!gradeItems[index] || (result !== 'right' && result !== 'wrong')) return;
    gradeItems[index] = Object.assign({}, gradeItems[index], {
      result: gradeItems[index].result === result ? '' : result
    });
    const right = gradeItems.filter((x) => x.result === 'right').length;
    const n = gradeItems.length;
    const allMarked = n > 0 && gradeItems.every((x) => x.result === 'right' || x.result === 'wrong');
    const patch = {
      gradeItems,
      markHint: '对 ' + right + ' / ' + n
    };
    if (allMarked && !this._scoreEdited) {
      patch.gradeScore = String(Math.round(right / n * 100));
    }
    this.setData(patch);
  },

  async confirmGrade() {
    const s = this.data.gradeStudent || {};
    if (!s.submissionId || this.data.grading) return;
    const marks = (this.data.gradeItems || []).map((x) => x.result || '');
    const marked = marks.filter(Boolean).length;
    const n = marks.length;
    if (marked && marked !== n) {
      return wx.showToast({ title: '请把每道题标成对或错', icon: 'none' });
    }
    let score = Number(this.data.gradeScore);
    if (Number.isNaN(score) || score < 0) {
      if (marked === n && n) score = Math.round(marks.filter((m) => m === 'right').length / n * 100);
      else return wx.showToast({ title: '请判对错或输入分数', icon: 'none' });
    }
    this.setData({ grading: true });
    try {
      const g = await callTeacher('gradeAssignment', {
        submissionId: s.submissionId,
        score,
        marks,
        comment: this.data.gradeComment || ''
      });
      if (!g.success) throw new Error(g.error || '批改失败');
      wx.showToast({ title: '已批改', icon: 'success' });
      this.setData({ gradeOpen: false });
      this.load();
    } catch (e) {
      wx.showToast({ title: e.message || '批改失败', icon: 'none' });
    } finally {
      this.setData({ grading: false });
    }
  },

  recallAssignment() {
    if (this.data.recalling || !this.data.id) return;
    wx.showModal({
      title: '撤回作业',
      content: '学生将立刻看不到这份作业。已交作答会留在库里，但不能再提交。',
      confirmText: '撤回',
      confirmColor: '#e11d48',
      success: (res) => {
        if (res.confirm) this.doRecall();
      }
    });
  },

  async doRecall() {
    if (this.data.recalling) return;
    this.setData({ recalling: true });
    try {
      const r = await callTeacher('deleteAssignment', { assignmentId: this.data.id });
      if (!r.success) throw new Error(r.error || '撤回失败');
      wx.showToast({ title: '已撤回', icon: 'success' });
      setTimeout(() => {
        const pages = getCurrentPages();
        if (pages.length > 1) wx.navigateBack();
        else wx.reLaunch({ url: '/pages/teacherAssignments/teacherAssignments' });
      }, 400);
    } catch (e) {
      wx.showToast({ title: e.message || '撤回失败', icon: 'none' });
      this.setData({ recalling: false });
    }
  }
});
