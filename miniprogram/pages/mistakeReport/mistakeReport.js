// pages/mistakeReport/mistakeReport.js
// 错因深度分析报告页：两种打开方式
//   ?ids=id1,id2     —— 从分类详情多选进入，现场生成并自动存档
//   ?reportId=xxx    —— 从历史列表进入，查看已保存的报告
const { parseSectionedText } = require('../../utils/sections');

Page({
  data: {
    loading: true,
    error: '',
    reportId: '',
    title: '',
    questionCount: 0,
    categories: [],
    createdAt: '',
    reportBlocks: []
  },

  onLoad(options) {
    if (options.reportId) {
      this.loadSavedReport(options.reportId);
    } else if (options.ids) {
      const ids = decodeURIComponent(options.ids).split(',').map(s => s.trim()).filter(Boolean);
      this.generateReport(ids);
    } else {
      this.setData({ loading: false, error: '页面参数缺失' });
    }
  },

  generateReport(ids) {
    if (ids.length < 1) {
      this.setData({ loading: false, error: '请至少选择 1 道错题' });
      return;
    }
    this.setData({ loading: true, error: '', questionCount: ids.length });
    wx.cloud.callFunction({
      name: 'answer',
      config: { timeout: 60000 },
      data: { action: 'mistakeReport', questionIds: ids },
      success: (res) => {
        const result = res.result || {};
        if (result.success && result.data && result.data.report) {
          this.applyReport(result.data);
        } else {
          this.setData({ loading: false, error: result.error || '报告生成失败，请返回重试' });
        }
      },
      fail: () => this.setData({ loading: false, error: '网络异常，请返回重试' })
    });
  },

  loadSavedReport(reportId) {
    this.setData({ loading: true, error: '' });
    wx.cloud.callFunction({
      name: 'answer',
      config: { timeout: 15000 },
      data: { action: 'getReport', reportId },
      success: (res) => {
        const result = res.result || {};
        if (result.success && result.data && result.data.report) {
          this.applyReport(result.data);
        } else {
          this.setData({ loading: false, error: result.error || '报告不存在或已删除' });
        }
      },
      fail: () => this.setData({ loading: false, error: '网络异常，请返回重试' })
    });
  },

  applyReport(data) {
    this.setData({
      loading: false,
      reportId: data.reportId || '',
      title: data.title || '错因分析报告',
      questionCount: data.questionCount || 0,
      categories: data.categories || [],
      createdAt: data.createdAt ? String(data.createdAt).slice(0, 16).replace('T', ' ') : '',
      reportBlocks: parseSectionedText(data.report)
    });
  },

  goHistory() {
    wx.redirectTo({ url: '/pages/reportList/reportList' });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) });
  }
});
