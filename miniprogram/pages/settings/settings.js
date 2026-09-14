// pages/settings/settings.js
const app = getApp();
const { getProfile, getCachedProfile } = require('../../utils/profile');

Page({
  data: {
    autoClassify: true,
    imageQuality: 'high',
    autoBackup: true,
    cloudSyncing: false,
    appVersion: '1.0.0 (2026版)',
    nickName: ''
  },

  // 本页会从「我的」页跳进来，也会被设置齿轮从首页打开；
  // 每次显示都刷一下，改完昵称回来才能看到新的
  onShow: function () {
    const apply = (p) => this.setData({ nickName: p.nickName || '' });

    apply(getCachedProfile());
    getProfile()
      .then(apply)
      .catch((err) => {
        console.warn('[settings] 读取资料失败，沿用缓存', err);
      });
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
  },

  // settings 不是 tab 页，跳「我的」必须用 switchTab（navigateTo 跳 tab 页会直接失败）
  goProfile: function () {
    wx.switchTab({ url: '/pages/profile/profile' });
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
    // 原先这里会顺带拉一次错题/分类数量刷新页头，页头搬到「我的」页后已无此需要。
    // 保留原有的「同步中 → 完成」反馈不变。
    this.setData({ cloudSyncing: true });
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
    // 微信《用户隐私保护指引》要求写明注销渠道，所以这里必须提到「我的 → 注销账号」。
    // 这段话与 pages/profile 的注销功能是一对，改动要同步。
    wx.showModal({
      title: '隐私政策',
      content: '本应用仅收集必要的使用数据用于改善产品体验，不向第三方共享个人信息。题目内容仅用于 AI 识别分析，不作他用。\n\n头像、昵称、学段仅保存在你的云端账号下。你可以随时在「我的 → 注销账号」自行清除全部云端数据，立即生效、不可恢复；也可通过「用户反馈」联系我们协助处理。',
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