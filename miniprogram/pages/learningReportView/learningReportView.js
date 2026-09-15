// pages/learningReportView/learningReportView.js
const { parseSectionedText } = require('../../utils/sections');

Page({
  data: {
    loading: true,
    generating: false,
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
      this.loadSaved(options.reportId);
    } else if (options.generate === '1') {
      this.generate();
    } else {
      this.setData({ loading: false, error: '页面参数缺失' });
    }
  },

  generate() {
    this.setData({ loading: true, generating: true, error: '' });
    wx.cloud.callFunction({
      name: 'answer',
      config: { timeout: 60000 },
      data: { action: 'generateLearningReport' },
      success: (res) => {
        const result = res.result || {};
        if (result.success && result.data && result.data.report) {
          this.applyReport(result.data);
        } else {
          this.setData({
            loading: false,
            generating: false,
            error: result.error || '报告生成失败，请返回重试'
          });
        }
      },
      fail: () => this.setData({
        loading: false,
        generating: false,
        error: '网络异常，请返回重试'
      })
    });
  },

  loadSaved(reportId) {
    this.setData({ loading: true, generating: false, error: '' });
    wx.cloud.callFunction({
      name: 'answer',
      config: { timeout: 15000 },
      data: { action: 'getLearningReport', reportId },
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
      generating: false,
      reportId: data.reportId || '',
      title: data.title || '学习报告',
      questionCount: data.questionCount || 0,
      categories: data.categories || [],
      createdAt: data.createdAt ? String(data.createdAt).slice(0, 16).replace('T', ' ') : '',
      reportBlocks: parseSectionedText(data.report)
    });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/learningReport/learningReport' }) });
  }
});
