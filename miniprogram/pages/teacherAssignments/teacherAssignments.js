const { callTeacher, formatDay } = require('../../utils/teacher');

Page({
  data: { assignments: [] },

  onLoad(options) {
    this._skip = !!(options && options.id);
    if (this._skip) {
      wx.redirectTo({ url: '/pages/teacherAssignmentDetail/teacherAssignmentDetail?id=' + options.id });
    }
  },
  onShow() {
    if (this._skip) return;
    this.load();
  },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },

  async load() {
    const r = await callTeacher('teacherAssignments');
    const assignments = ((r.success && r.data) || []).map((a) => ({
      ...a,
      dueText: a.dueAt ? formatDay(a.dueAt) : '未设截止'
    }));
    this.setData({ assignments });
  },

  goCreate() {
    const pick = getApp().globalData.teacherPick || {};
    const ids = Array.isArray(pick.questionIds) ? pick.questionIds : [];
    if (!ids.length) {
      wx.showToast({ title: '请先到组卷选题', icon: 'none' });
      setTimeout(() => wx.reLaunch({ url: '/pages/teacherPaper/teacherPaper' }), 400);
      return;
    }
    wx.navigateTo({
      url: '/pages/teacherAssignmentCreate/teacherAssignmentCreate?mode=homework&classId=' + (pick.classId || '')
    });
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/teacherAssignmentDetail/teacherAssignmentDetail?id=' + id });
  }
});
