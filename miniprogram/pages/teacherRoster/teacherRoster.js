const { callTeacher } = require('../../utils/teacher');

function withMark(list) {
  return (list || []).map((s) => ({
    ...s,
    nickName: s.nickName || '未设置昵称',
    mark: (s.nickName || '学').slice(0, 1)
  }));
}

function filterByName(list, keyword) {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) return list;
  return list.filter((s) => String(s.nickName || '').toLowerCase().indexOf(kw) >= 0);
}

Page({
  data: {
    loading: true,
    classId: '',
    className: '',
    keyword: '',
    students: [],
    visible: []
  },

  onLoad(options) {
    const classId = (options && options.classId) || '';
    let className = '';
    try {
      className = decodeURIComponent((options && options.name) || '');
    } catch (e) {
      className = (options && options.name) || '';
    }
    this.setData({ classId, className });
    if (className) wx.setNavigationBarTitle({ title: className });
    this.load();
  },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },

  async load() {
    const classId = this.data.classId;
    if (!classId) {
      this.setData({ loading: false });
      return wx.showToast({ title: '缺少班级', icon: 'none' });
    }
    this.setData({ loading: true });
    try {
      const result = await callTeacher('students', { classId });
      if (!result.success) throw new Error(result.error || '加载失败');
      const students = withMark(result.data);
      this.setData({
        students,
        visible: filterByName(students, this.data.keyword)
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onSearch(e) {
    const keyword = e.detail.value || '';
    this.setData({
      keyword,
      visible: filterByName(this.data.students, keyword)
    });
  },

  clearSearch() {
    this.setData({
      keyword: '',
      visible: this.data.students
    });
  },

  showStudent(e) {
    const studentId = e.currentTarget.dataset.id;
    const classId = this.data.classId;
    if (!studentId || !classId) return;
    wx.navigateTo({
      url: `/pages/teacherStudent/teacherStudent?classId=${classId}&studentId=${studentId}`
    });
  }
});
