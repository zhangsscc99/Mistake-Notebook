// pages/learningReport/learningReport.js
// 总览不调模型。点「生成一份」才进详情页跑 AI，历史报告也从这里打开。

function decorateOverview(raw) {
  const o = raw || {};
  const cats = Array.isArray(o.categories) ? o.categories.slice() : [];
  const max = Math.max.apply(null, cats.map((c) => c.count).concat([1]));
  const d = o.difficulties || {};
  const total = o.questionCount || 0;
  const pct = (n) => (total ? Math.round((Number(n) || 0) * 100 / total) : 0);
  return {
    questionCount: o.questionCount || 0,
    categoryCount: o.categoryCount || cats.length,
    categories: cats.map((c) => ({
      name: c.name || '未分类',
      count: c.count || 0,
      pct: Math.round(((c.count || 0) / max) * 100)
    })),
    easy: d.EASY || 0,
    medium: d.MEDIUM || 0,
    hard: d.HARD || 0,
    easyPct: pct(d.EASY),
    mediumPct: pct(d.MEDIUM),
    hardPct: pct(d.HARD),
    masteredCount: o.masteredCount || 0,
    favoriteCount: o.favoriteCount || 0,
    pinnedCount: o.pinnedCount || 0,
    noteCount: o.noteCount || 0,
    paperCount: o.paperCount || 0,
    checkinStreak: o.checkinStreak || 0,
    checkinTotalDays: o.checkinTotalDays || 0,
    stage: o.stage || '',
    canGenerate: !!o.canGenerate,
    minQuestions: o.minQuestions || 1
  };
}

function formatTime(iso) {
  return iso ? String(iso).slice(0, 16).replace('T', ' ') : '';
}

Page({
  data: {
    loading: true,
    error: '',
    overview: decorateOverview({}),
    list: []
  },

  onShow() {
    this.fetchAll();
  },

  onPullDownRefresh() {
    this.fetchAll();
  },

  fetchAll() {
    this.setData({ error: '' });
    const overviewReq = new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'answer',
        config: { timeout: 20000 },
        data: { action: 'learningOverview' },
        success: (res) => resolve(res.result || {}),
        fail: reject
      });
    });
    const listReq = new Promise((resolve) => {
      wx.cloud.callFunction({
        name: 'answer',
        config: { timeout: 15000 },
        data: { action: 'listLearningReports', page: 0, size: 50 },
        success: (res) => resolve(res.result || {}),
        fail: () => resolve({ success: true, data: { list: [] } })
      });
    });

    Promise.all([overviewReq, listReq])
      .then(([ovRes, listRes]) => {
        if (!ovRes.success) throw new Error(ovRes.error || '总览加载失败');
        const list = ((listRes.success && listRes.data && listRes.data.list) || []).map((item) => ({
          ...item,
          createdAtText: formatTime(item.createdAt)
        }));
        this.setData({
          loading: false,
          overview: decorateOverview(ovRes.data),
          list
        });
      })
      .catch((err) => {
        this.setData({
          loading: false,
          error: err.message || '加载失败，下拉重试'
        });
      })
      .then(() => wx.stopPullDownRefresh());
  },

  onGenerate() {
    const o = this.data.overview || {};
    if (!o.canGenerate) {
      wx.showToast({
        title: `至少收录 ${o.minQuestions || 1} 道错题`,
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({ url: '/pages/learningReportView/learningReportView?generate=1' });
  },

  openReport(e) {
    const reportId = e.currentTarget.dataset.id;
    if (!reportId) return;
    wx.navigateTo({
      url: `/pages/learningReportView/learningReportView?reportId=${reportId}`
    });
  },

  deleteReport(e) {
    const reportId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除报告',
      content: '删除后不可恢复，确定删除这份学习报告吗？',
      confirmText: '删除',
      confirmColor: '#e11d48',
      success: (res) => {
        if (!res.confirm) return;
        wx.cloud.callFunction({
          name: 'answer',
          data: { action: 'deleteLearningReport', reportId },
          success: (r) => {
            const result = r.result || {};
            if (result.success) {
              this.setData({
                list: this.data.list.filter((item) => item.reportId !== reportId)
              });
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
