const { callTeacher, formatDay } = require('../../utils/teacher');

Page({
  data: {
    classes: [],
    selectedClass: {},
    generating: false,
    history: []
  },

  onLoad(options) {
    this._preferClassId = (options && options.classId) || '';
    this.boot();
  },
  onShow() {
    if (this.data.selectedClass.id) this.loadHistory();
  },
  onPullDownRefresh() {
    this.loadHistory().finally(() => wx.stopPullDownRefresh());
  },

  async boot() {
    const dash = await callTeacher('dashboard');
    const classes = (dash.success && dash.data && dash.data.classes) || [];
    const selectedClass = classes.find((c) => c.id === this._preferClassId) || classes[0] || {};
    this.setData({ classes, selectedClass });
    await this.loadHistory();
  },

  async loadHistory() {
    const classId = this.data.selectedClass.id;
    if (!classId) {
      this.setData({ history: [] });
      return;
    }
    const r = await callTeacher('listParentReports', { classId });
    const history = ((r.success && r.data) || []).map((p) => ({
      ...p,
      createdText: formatDay(p.createdAt)
    }));
    this.setData({ history });
  },

  selectClass(e) {
    const item = this.data.classes.find((c) => c.id === e.currentTarget.dataset.id);
    if (!item) return;
    this.setData({ selectedClass: item });
    this.loadHistory();
  },

  async generate() {
    const classId = this.data.selectedClass.id;
    if (!classId) return wx.showToast({ title: '请先选择班级', icon: 'none' });
    if (this.data.generating) return;
    this.setData({ generating: true });
    try {
      const r = await callTeacher('parentReport', { classId }, 20000);
      if (!r.success) throw new Error(r.error || '生成失败');
      const id = (r.data && (r.data.id || r.data._id)) || '';
      await this.loadHistory();
      wx.showToast({ title: '报告已生成', icon: 'success' });
      if (id) {
        setTimeout(() => {
          wx.navigateTo({ url: '/pages/teacherReportDetail/teacherReportDetail?id=' + id });
        }, 400);
      }
    } catch (e) {
      wx.showToast({ title: e.message || '生成失败', icon: 'none' });
    } finally {
      this.setData({ generating: false });
    }
  },

  openHistory(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/teacherReportDetail/teacherReportDetail?id=' + id });
  }
});
