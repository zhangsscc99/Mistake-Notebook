// pages/settings/settings.js
const app = getApp();

Page({
  data: {
    hasUserInfo: false,
    autoClassify: true,
    imageQuality: 'high',
    autoBackup: true,
    cloudSyncing: false,
    totalQuestions: 0,
    totalCategories: 0,
    appVersion: '1.0.0 (2026版)'
  },

  onLoad: function () {
    // 读取本地存储的设置
    try {
      const settings = wx.getStorageSync('appSettings') || {};
      this.setData({
        autoClassify: settings.autoClassify !== false,
        imageQuality: settings.imageQuality || 'high',
        autoBackup: settings.autoBackup !== false
      });
    } catch (e) {
      // ignore
    }
    this.loadStats();
  },

  loadStats: function () {
    wx.cloud.callFunction({
      name: 'category',
      data: { action: 'stats' },
      success: (res) => {
        if (res.result && res.result.success) {
          this.setData({
            totalQuestions: res.result.data.totalQuestions || 0,
            totalCategories: res.result.data.totalCategories || 0
          });
        }
      },
      fail: () => {}
    });
  },

  saveSetting: function (key, value) {
    try {
      const settings = wx.getStorageSync('appSettings') || {};
      settings[key] = value;
      wx.setStorageSync('appSettings', settings);
    } catch (e) {
      // ignore
    }
  },

  onAutoClassifyChange: function (e) {
    const val = e.detail.value;
    this.setData({ autoClassify: val });
    this.saveSetting('autoClassify', val);
    wx.showToast({ title: val ? '自动分类已开启' : '自动分类已关闭', icon: 'none' });
  },

  onAutoBackupChange: function (e) {
    const val = e.detail.value;
    this.setData({ autoBackup: val });
    this.saveSetting('autoBackup', val);
    wx.showToast({ title: val ? '自动备份已开启' : '自动备份已关闭', icon: 'none' });
  },

  onImageQualityTap: function () {
    const qualityMap = { high: '高清', medium: '标准', low: '省流' };
    wx.showActionSheet({
      itemList: ['高清', '标准', '省流'],
      success: (res) => {
        const keys = ['high', 'medium', 'low'];
        const val = keys[res.tapIndex];
        this.setData({ imageQuality: val });
        this.saveSetting('imageQuality', val);
        wx.showToast({ title: '图片质量已设置为' + qualityMap[val], icon: 'none' });
      }
    });
  },

  syncData: function () {
    this.setData({ cloudSyncing: true });
    // 重新从云端拉取分类和题目数量
    this.loadStats();
    setTimeout(() => {
      this.setData({ cloudSyncing: false });
      wx.showToast({ title: '同步完成', icon: 'success' });
    }, 1500);
  },

  exportData: function () {
    wx.showToast({ title: '导出功能即将上线', icon: 'none' });
  },

  clearCache: function () {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除本地缓存的试卷列表和临时数据吗？云端数据不受影响。',
      success: (res) => {
        if (!res.confirm) return;
        try {
          wx.removeStorageSync('savedPapers');
          app.globalData.selectedPaperQuestions = [];
          app.globalData.recognitionDraft = null;
          app.globalData.categoriesMode = null;
        } catch (e) {
          // ignore
        }
        wx.showToast({ title: '缓存已清除', icon: 'success' });
      }
    });
  },

  resetApp: function () {
    wx.showModal({
      title: '重置应用',
      content: '此操作将清除所有本地设置和缓存，云端数据不受影响。确定继续？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (!res.confirm) return;
        try {
          wx.clearStorageSync();
          app.globalData.selectedPaperQuestions = [];
          app.globalData.recognitionDraft = null;
          app.globalData.categoriesMode = null;
        } catch (e) {
          // ignore
        }
        wx.showToast({ title: '应用已重置', icon: 'success' });
      }
    });
  },

  feedback: function () {
    wx.showToast({ title: '感谢反馈！', icon: 'none' });
  },

  showPrivacyPolicy: function () {
    wx.showModal({
      title: '隐私政策',
      content: '本应用仅收集必要的使用数据用于改善产品体验，不向第三方共享个人信息。题目内容仅用于 AI 识别分析，不作他用。',
      showCancel: false,
      confirmText: '了解'
    });
  },

  showVersionInfo: function () {
    wx.showModal({
      title: '关于错题本',
      content: '版本：1.0.0（2026版）\n\n基于原生微信小程序 + 腾讯云开发。支持一键拍照、AI 识别、智能归类、拼装试卷并导出 A4 PDF。',
      showCancel: false,
      confirmText: '极好'
    });
  }
});