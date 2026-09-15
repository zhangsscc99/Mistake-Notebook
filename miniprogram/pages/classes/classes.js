Page({
  data: { classes: [], notebooks: [], assignments: [], loading: true },
  onLoad() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  call(action) {
    return new Promise((resolve, reject) => wx.cloud.callFunction({
      name: 'teacher',
      data: { action },
      success: (r) => resolve(r.result || {}),
      fail: reject
    }));
  },
  async load() {
    this.setData({ loading: true });
    try {
      const [c, n, a] = await Promise.all([
        this.call('myClasses'),
        this.call('myNotebooks'),
        this.call('myAssignments')
      ]);
      this.setData({
        classes: c.success ? c.data || [] : [],
        notebooks: n.success ? n.data || [] : [],
        assignments: a.success ? (a.data || []).map((x) => ({
          ...x,
          questionCount: (x.questionIds || []).length
        })) : []
      });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  openAssignment(e) {
    wx.navigateTo({ url: `/pages/assignment/assignment?id=${e.currentTarget.dataset.id}` });
  }
});
