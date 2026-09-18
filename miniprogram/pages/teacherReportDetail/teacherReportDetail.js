const { callTeacher, decorateReport, buildCopyText } = require('../../utils/teacher');

Page({
  data: {
    loading: true,
    report: null
  },

  onLoad(options) {
    this.reportId = (options && options.id) || '';
    this.load();
  },

  async load() {
    if (!this.reportId) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true });
    try {
      const r = await callTeacher('parentReportDetail', { id: this.reportId });
      if (!r.success) throw new Error(r.error || '加载失败');
      this.setData({ report: decorateReport(r.data), loading: false });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
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
    const classId = this.data.report && this.data.report.classId;
    if (!studentId || !classId) return;
    wx.navigateTo({
      url: '/pages/teacherStudent/teacherStudent?classId=' + classId + '&studentId=' + studentId
    });
  }
});
