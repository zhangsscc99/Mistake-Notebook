// pages/reportList/reportList.js
// 错因分析历史报告列表（mistake_reports 按 openid 归属）
Page({
  data: {
    loading: true,
    list: []
  },

  onShow() {
    this.fetchList();
  },

  onPullDownRefresh() {
    this.fetchList();
  },

  fetchList() {
    this.setData({ loading: true });
    wx.cloud.callFunction({
      name: 'answer',
      config: { timeout: 15000 },
      data: { action: 'listReports', page: 0, size: 50 },
      success: (res) => {
        const result = res.result || {};
        if (result.success && result.data) {
          const list = (result.data.list || []).map((item) => ({
            ...item,
            createdAtText: item.createdAt ? String(item.createdAt).slice(0, 16).replace('T', ' ') : ''
          }));
          this.setData({ list, loading: false });
        } else {
          this.setData({ list: [], loading: false });
        }
      },
      fail: () => this.setData({ list: [], loading: false }),
      complete: () => wx.stopPullDownRefresh()
    });
  },

  openReport(e) {
    const reportId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/mistakeReport/mistakeReport?reportId=${reportId}` });
  },

  deleteReport(e) {
    const reportId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除报告',
      content: '删除后不可恢复，确定删除这份报告吗？',
      confirmText: '删除',
      confirmColor: '#e11d48',
      success: (res) => {
        if (!res.confirm) return;
        wx.cloud.callFunction({
          name: 'answer',
          data: { action: 'deleteReport', reportId },
          success: (r) => {
            const result = r.result || {};
            if (result.success) {
              this.setData({ list: this.data.list.filter((item) => item.reportId !== reportId) });
              wx.showToast({ title: '已删除', icon: 'success' });
            } else {
              wx.showToast({ title: result.error || '删除失败', icon: 'none' });
            }
          },
          fail: () => wx.showToast({ title: '网络异常，请重试', icon: 'none' })
        });
      }
    });
  },

  goCategories() {
    wx.switchTab({ url: '/pages/categories/categories' });
  }
});
