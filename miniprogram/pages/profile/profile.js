// pages/profile/profile.js
const app = getApp();
const { ensureCloudSession, isAccessTokenError } = require('../../utils/cloud');
const {
  STAGES,
  getProfile,
  getCachedProfile,
  setCachedProfile,
  clearProfileCache
} = require('../../utils/profile');

const MAX_NICKNAME_LEN = 20;

// 服务端 failed[].target 是内部标识（chatMemories / papers / users / avatarFile），
// 直接拼进弹窗会漏出英文命名，所以在这里翻成人话。
// 认不出来的标识原样显示 —— 宁可难看也不能吞掉一条失败项。
const FAILED_LABELS = {
  chatMemories: '对话记忆',
  papers: '试卷',
  users: '个人资料',
  'users:read': '个人资料',
  avatarFile: '头像图片'
};

function failedLabel(item) {
  const target = (item && item.target) || '';
  return FAILED_LABELS[target] || target || '未知项目';
}

Page({
  data: {
    openId: '',
    nickName: '',
    avatarFileID: '',
    stage: '',
    stages: STAGES,
    hasProfile: false,
    loading: true,
    saving: false,
    savingStage: false,
    uploadingAvatar: false,
    deleting: false,
    totalQuestions: 0,
    totalCategories: 0,
    appVersion: '1.0.0 (2026版)'
  },

  onShow: function () {
    this._nickDraft = '';
    // 先用缓存铺上，否则每次切回本页头像昵称都会空一下再出现
    this.applyProfile(getCachedProfile());
    this.loadProfile();
    this.loadStats();
  },

  applyProfile: function (p) {
    this.setData({
      openId: p.openId,
      nickName: p.nickName,
      avatarFileID: p.avatarFileID,
      stage: p.stage,
      hasProfile: p.hasProfile
    });
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
    // force:true —— 本页是资料的权威展示面，缓存只用来先铺屏，背后照常拉一次最新的。
    // 其他页面用非 force 的版本，命中缓存就不打云函数。
    return getProfile({ force: true })
      .then((p) => {
        this.applyProfile(p);
        this.setData({ loading: false });
      })
      .catch((err) => {
        console.error('[profile] 读取资料失败', err);
        // 拉失败就继续用缓存铺的那份，不要把已经显示出来的头像昵称清掉
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
        this.applyProfile(setCachedProfile(res.data));
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
        this.applyProfile(setCachedProfile(res.data));
        wx.showToast({ title: '已保存', icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        console.error('[profile] 保存昵称失败', err);
        wx.showToast({ title: err.message || '保存失败，请重试', icon: 'none' });
      })
      .then(() => this.setData({ saving: false }));
  },

  // 学段选中即保存，不走 form 提交。
  // 理由：chip 和输入框是两套状态，若攒到「保存昵称」才一起提交，
  // 用户选了学段却没改昵称（或昵称没变化被拦下）就会以为存上了，实际没存。
  onStageSelect: function (e) {
    if (this.data.savingStage) return;

    const stage = e.currentTarget.dataset.value;
    const prev = this.data.stage;
    if (!stage || stage === prev) return;

    this.setData({ stage, savingStage: true });

    this.callCloud('user', { action: 'updateProfile', stage }, 30000)
      .then((res) => {
        if (!res.success) throw new Error(res.error || '保存失败');
        this.applyProfile(setCachedProfile(res.data));
        this.setData({ savingStage: false });
        wx.showToast({ title: '已保存', icon: 'success' });
      })
      .catch((err) => {
        // 失败要退回原值：界面上显示着一个并没存进去的学段，比不显示更糟
        this.setData({ stage: prev, savingStage: false });
        console.error('[profile] 保存学段失败', err);
        wx.showToast({ title: err.message || '保存失败，请重试', icon: 'none' });
      });
  },

  onDeleteAccount: function () {
    if (this.data.deleting) return;

    // 第一步：说清楚删什么、不删什么。
    // 「题目不删」必须写在这里 —— 题目是全局共享的（写入时就没有归属字段），
    // 注销确实动不了它，含糊过去等于虚假承诺。
    wx.showModal({
      title: '注销账号',
      content: '将永久删除：\n· 个人资料（头像、昵称、学段）\n· 全部 AI 对话记忆\n· 全部试卷\n\n不会删除：\n· 错题本身（题目为公共题库，不归属个人）\n\n删除后无法恢复。',
      confirmText: '继续',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) this.confirmDeleteAccount();
      }
    });
  },

  confirmDeleteAccount: function () {
    wx.showModal({
      title: '最后确认',
      content: '再次确认删除全部云端数据？\n\n注意：微信账号本身不受影响，下次进入仍可正常使用，只是资料是空白的。',
      confirmText: '确认删除',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) this.doDeleteAccount();
      }
    });
  },

  doDeleteAccount: function () {
    this.setData({ deleting: true });
    wx.showLoading({ title: '注销中...', mask: true });

    this.callCloud('user', { action: 'deleteAccount' }, 60000)
      .then((res) => {
        if (!res.success) throw new Error(res.error || '注销失败');

        const failed = (res.data && res.data.failed) || [];

        // 定点清理，不用 wx.clearStorageSync() —— 那会连 appSettings
        // （自动分类 / 图片质量 / 自动备份）一起抹掉，而用户只是想删账号数据。
        clearProfileCache();
        try {
          wx.removeStorageSync('savedPapers');
        } catch (err) {
          // ignore
        }
        app.globalData.selectedPaperQuestions = [];
        app.globalData.recognitionDraft = null;

        // openId 要留着：微信不给撤销 openid，用户还是同一个人，
        // 后面点头像换头像还得靠它拼归属路径
        this.setData({
          nickName: '',
          avatarFileID: '',
          stage: '',
          hasProfile: false,
          deleting: false
        });
        wx.hideLoading();

        if (failed.length) {
          // 部分失败必须说出来。静默当成成功，用户会以为删干净了 ——
          // 这是本功能最危险的失败模式
          wx.showModal({
            title: '部分数据未能清除',
            content: '以下项目删除失败：' + failed.map(failedLabel).join('、') + '\n请稍后重试。',
            showCancel: false
          });
        } else {
          wx.showToast({ title: '云端数据已清除', icon: 'success' });
        }
      })
      .catch((err) => {
        this.setData({ deleting: false });
        wx.hideLoading();
        console.error('[profile] 注销失败', err);
        wx.showToast({ title: err.message || '注销失败，请重试', icon: 'none' });
      });
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
