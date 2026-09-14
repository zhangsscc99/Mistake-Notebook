// pages/profile/profile.js
const app = getApp();
const { ensureCloudSession, isAccessTokenError } = require('../../utils/cloud');

const MAX_NICKNAME_LEN = 20;

Page({
  data: {
    openId: '',
    nickName: '',
    avatarFileID: '',
    hasProfile: false,
    loading: true,
    saving: false,
    uploadingAvatar: false,
    totalQuestions: 0,
    totalCategories: 0,
    appVersion: '1.0.0 (2026版)'
  },

  onShow: function () {
    this._nickDraft = '';
    this.loadProfile();
    this.loadStats();
  },

  // 与 pages/index/index.js:157-177 同款包装（项目没有统一封装，各页内联是既有约定）
  callCloud: function (name, data, timeout) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name,
        data,
        config: { timeout: timeout || 60000 },
        success: (res) => resolve(res.result || {}),
        fail: reject
      });
    });
  },

  loadProfile: function () {
    return this.callCloud('user', { action: 'get' }, 15000)
      .then((res) => {
        if (!res.success) throw new Error(res.error || '读取资料失败');
        const d = res.data || {};
        const profile = {
          openId: d.openId || '',
          nickName: d.nickName || '',
          avatarFileID: d.avatarFileID || '',
          hasProfile: !!d.exists
        };
        app.globalData.profile = profile;
        this.setData({
          ...profile,
          loading: false
        });
      })
      .catch((err) => {
        console.error('[profile] 读取资料失败', err);
        this.setData({ loading: false });
        wx.showToast({
          title: isAccessTokenError(err) ? '云开发未登录，请重进小程序' : '资料读取失败',
          icon: 'none'
        });
      });
  },

  loadStats: function () {
    this.callCloud('category', { action: 'stats' }, 15000)
      .then((res) => {
        if (!res.success) return;
        const d = res.data || {};
        this.setData({
          totalQuestions: d.totalQuestions || 0,
          totalCategories: d.totalCategories || 0
        });
      })
      .catch(() => {});
  },

  // chooseAvatar 给的是临时路径（约 2 小时失效），必须立刻转存云存储换永久 fileID
  onChooseAvatar: function (e) {
    const tempFilePath = e.detail && e.detail.avatarUrl;
    if (!tempFilePath) return;
    this.uploadAvatar(tempFilePath);
  },

  uploadAvatar: function (tempFilePath) {
    if (this.data.uploadingAvatar) return;
    // 没有 openid 就拼不出归属路径，传上去也会被服务端拒绝，白白留个孤儿文件
    if (!this.data.openId) {
      wx.showToast({ title: '资料还没加载好，请稍后重试', icon: 'none' });
      return;
    }

    this.setData({ uploadingAvatar: true });
    wx.showLoading({ title: '上传中...', mask: true });

    ensureCloudSession()
      .then(() => {
        const rand = Math.random().toString(36).slice(2, 8);
        const cloudPath = 'avatars/' + this.data.openId + '/' + Date.now() + '_' + rand + '.jpg';
        return new Promise((resolve, reject) => {
          wx.cloud.uploadFile({
            cloudPath,
            filePath: tempFilePath,
            config: { timeout: 60000 },
            success: resolve,
            fail: reject
          });
        });
      })
      .then((up) => this.callCloud('user', {
        action: 'updateProfile',
        avatarFileID: up.fileID
      }, 30000))
      .then((res) => {
        if (!res.success) throw new Error(res.error || '保存失败');
        wx.hideLoading();
        this.setData({
          avatarFileID: res.data.avatarFileID,
          hasProfile: true
        });
        app.globalData.profile = { ...app.globalData.profile, ...res.data };
        wx.showToast({ title: '头像已更新', icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        console.error('[profile] 头像上传失败', err);
        wx.showToast({
          title: isAccessTokenError(err) ? '云开发未登录，请重进小程序' : '头像上传失败，请重试',
          icon: 'none'
        });
      })
      // 前面 catch 过，这里等价于 finally（小程序运行时不一定有 Promise.finally）
      .then(() => this.setData({ uploadingAvatar: false }));
  },

  onNickInput: function (e) {
    const val = e.detail.value;
    // 记住最后一次非空输入：用于区分「用户自己清空」和「安全检测清空」
    if (val) this._nickDraft = val;
    // 空值也要回写，否则 value 是绑定的，用户手动清空会被弹回旧值
    this.setData({ nickName: val });
  },

  onNickBlur: function (e) {
    if (e.detail.value === '' && this._nickDraft) {
      // 基础库 2.24.4 起 blur 会异步做安全检测，未通过会清空输入框。
      // 这里不强行恢复用户的原输入（会和平台的检测反复打架），只提示；
      // 提交时还会再拦一次空值，所以不会有空昵称落库。
      wx.showToast({ title: '昵称可能未通过安全检测，请修改后重试', icon: 'none' });
    }
  },

  // 走 form 提交：type="nickname" 的输入框在点键盘上方昵称条填入时 bindinput 不保证触发，
  // 而 form 提交读的是输入框当前值，最可靠
  onSaveProfile: function (e) {
    if (this.data.saving) return;

    const nickName = ((e.detail.value && e.detail.value.nickName) || '').trim();

    if (!nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    if ([...nickName].length > MAX_NICKNAME_LEN) {
      wx.showToast({ title: `昵称不能超过 ${MAX_NICKNAME_LEN} 个字`, icon: 'none' });
      return;
    }
    if (nickName === this.data.nickName && this.data.hasProfile) {
      wx.showToast({ title: '昵称没有变化', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...', mask: true });

    this.callCloud('user', { action: 'updateProfile', nickName }, 30000)
      .then((res) => {
        if (!res.success) throw new Error(res.error || '保存失败');
        wx.hideLoading();
        // 以服务端返回为准：它做了 trim 和长度校验，才是权威
        this.setData({
          nickName: res.data.nickName || '',
          hasProfile: true
        });
        app.globalData.profile = { ...app.globalData.profile, ...res.data };
        wx.showToast({ title: '已保存', icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        console.error('[profile] 保存昵称失败', err);
        wx.showToast({ title: err.message || '保存失败，请重试', icon: 'none' });
      })
      .then(() => this.setData({ saving: false }));
  },

  // settings 不是 tab 页，这里必须用 navigateTo；反过来 settings 跳回本页要用 switchTab
  goSettings: function () {
    wx.navigateTo({ url: '/pages/settings/settings' });
  },

  goCategories: function () {
    wx.switchTab({ url: '/pages/categories/categories' });
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
