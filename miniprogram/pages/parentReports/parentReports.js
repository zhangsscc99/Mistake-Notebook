const { callParent, selectedChildId, setSelectedChildId } = require('../../utils/parent');
const { formatDay } = require('../../utils/teacher');

function decorateReport(raw) {
  const x = raw || {};
  const stu = x.student || {};
  return {
    ...x,
    createdText: formatDay(x.createdAt),
    averageText: stu.averageScore != null ? (stu.averageScore + '分') : '暂无均分',
    weakText: stu.weak ? ('薄弱：' + stu.weak) : '暂无薄弱项'
  };
}

Page({
  data: {
    loading: true,
    children: [],
    childId: '',
    reports: []
  },

  onShow() {
    this.load();
  },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: true });
    try {
      const r = await callParent('myChildren');
      if (!r.success) throw new Error(r.error || '加载失败');
      const children = r.data || [];
      let childId = selectedChildId();
      if (childId && !children.some((c) => c.studentId === childId)) childId = '';
      if (!childId && children[0]) childId = children[0].studentId;
      setSelectedChildId(childId);
      let reports = [];
      if (childId) {
        const p = await callParent('childReports', { studentId: childId });
        if (!p.success) throw new Error(p.error || '报告加载失败');
        reports = (p.data || []).map(decorateReport);
      }
      this.setData({ children, childId, reports });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  selectChild(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || id === this.data.childId) return;
    setSelectedChildId(id);
    this.load();
  },

  openReport(e) {
    const id = e.currentTarget.dataset.id;
    const studentId = this.data.childId;
    if (!id || !studentId) return;
    wx.navigateTo({
      url: '/pages/parentReportDetail/parentReportDetail?id=' + id + '&studentId=' + studentId
    });
  }
});
