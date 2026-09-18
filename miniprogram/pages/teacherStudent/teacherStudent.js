const { callTeacher, formatDay } = require('../../utils/teacher');

Page({
  data: {
    loading: true,
    classId: '',
    studentId: '',
    student: {},
    className: '',
    joinedText: '',
    activeText: '',
    questionCount: 0,
    submittedCount: 0,
    missingCount: 0,
    categories: [],
    homework: [],
    questions: [],
    parentCode: '',
    visibleQuestions: [],
    category: '',
    categoryChips: []
  },

  onLoad(options) {
    this.setData({
      classId: (options && options.classId) || '',
      studentId: (options && options.studentId) || ''
    });
    this.load();
  },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },

  async load() {
    const { classId, studentId } = this.data;
    if (!classId || !studentId) {
      this.setData({ loading: false });
      return wx.showToast({ title: '缺少学生信息', icon: 'none' });
    }
    this.setData({ loading: true });
    try {
      const r = await callTeacher('studentOverview', { classId, studentId });
      if (!r.success) throw new Error(r.error || '加载失败');
      const d = r.data || {};
      const questions = (d.questions || []).map((q, i) => ({
        ...q,
        index: i + 1,
        day: formatDay(q.createdAt)
      }));
      const homework = (d.homework || []).map((h) => ({
        ...h,
        dueText: h.dueAt ? formatDay(h.dueAt) : '未设截止'
      }));
      const categoryChips = [{ name: '全部', value: '' }].concat(
        (d.categories || []).map((c) => ({ name: c.name, value: c.name }))
      );
      const student = d.student || {};
      this.setData({
        student,
        className: d.className || '',
        joinedText: formatDay(student.joinedAt) || '未知',
        activeText: formatDay(student.lastActiveAt) || '暂无',
        questionCount: d.questionCount || 0,
        submittedCount: d.submittedCount || 0,
        missingCount: d.missingCount || 0,
        categories: d.categories || [],
        homework,
        questions,
        parentCode: student.parentCode || '',
        visibleQuestions: questions,
        categoryChips,
        category: ''
      });
      wx.setNavigationBarTitle({ title: student.nickName || '学生情况' });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  applyCategory(category) {
    const questions = this.data.questions || [];
    const visibleQuestions = category
      ? questions.filter((q) => (q.category || '未分类') === category)
      : questions;
    this.setData({ category, visibleQuestions });
  },

  selectCategory(e) {
    const value = e.currentTarget.dataset.value || '';
    this.applyCategory(value);
  },

  openQuestion(e) {
    const id = e.currentTarget.dataset.id;
    const q = this.data.questions.find((x) => x.id === id);
    if (!q) return;
    wx.showModal({
      title: q.category || '错题',
      content: `${q.content || ''}${q.day ? `\n\n录入：${q.day}` : ''}`,
      showCancel: false
    });
  },

  copyParentCode() {
    const code = this.data.parentCode;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  },

  openHomework(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/teacherAssignmentDetail/teacherAssignmentDetail?id=' + id });
  }
});
