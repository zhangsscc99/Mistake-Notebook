const { callTeacher, formatDay, isPastDue } = require('../../utils/teacher');

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
      dueText: a.dueAt ? ((isPastDue(a.dueAt) ? '已截止 ' : '截止 ') + formatDay(a.dueAt)) : '未设截止'
    }));
    this.setData({ assignments });
  },

  goPaper() {
    wx.reLaunch({ url: '/pages/teacherPaper/teacherPaper' });
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/teacherAssignmentDetail/teacherAssignmentDetail?id=' + id });
  }
});
