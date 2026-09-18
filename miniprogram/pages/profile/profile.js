// pages/profile/profile.js
const app = getApp();
const { ensureCloudSession, isAccessTokenError } = require('../../utils/cloud');
const {
  STAGES,
  getProfile,
  getCachedProfile,
  setCachedProfile
} = require('../../utils/profile');
const { clearSession, goLogin, dismissLoginOverlay, bounceTeacherOffStudentShell } = require('../../utils/auth');
const { performDeleteAccount, finishDeleteAccount } = require('../../utils/account');
const { checkinCard, inviteCard, enableShareMenu } = require('../../utils/share');
const { renderInvitePoster, savePosterToAlbum, saveFailHint } = require('../../utils/invitePoster');
const { pickAvatarPhoto, isCancel } = require('../../utils/avatar');
const { buildAchievements, EMPTY_ACH } = require('../../utils/achievements');

const MAX_NICKNAME_LEN = 20;

// 云函数返回的是 UTC ISO，这里按北京时间显示。
// +8 之后取 UTC 字段，不能取本地字段 —— 用户手机时区不一定在北京
function formatCnDate(iso) {
  const ms = Date.parse(iso || '');
  if (!ms) return '';
  const d = new Date(ms + 8 * 60 * 60 * 1000);
  return `${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日`;
}

// 在钱包对象上补几个展示用派生字段，省得 wxml 里塞计算和日期逻辑
function decorateWallet(raw) {
  const w = { ...(raw || {}) };
  w.vipExpireText = formatCnDate(w.vipExpireAt);
  w.coinGap = Math.max(0, (w.vipCost || 0) - (w.coins || 0));
  w.canRedeem = !!w.isVip || w.coinGap === 0;
  return w;
}

const EMPTY_WALLET = {
  coins: 0,
  isVip: false,
  vipExpireAt: '',
  vipExpireText: '',
  vipCost: 0,
  vipDays: 0,
  checkinStreak: 0,
  checkinTotalDays: 0,
  todayChecked: false,
  todayBonus: { base: 0, chat: 0, paper: 0, total: 0 },
  recentDays: [],
  favoriteCount: 0,
  pinnedCount: 0,
  questionCount: 0,
  paperCount: 0,
  noteCount: 0,
  reportCount: 0
};

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
    appVersion: '1.0.0 (2026版)',

    // 打卡 / 金币 / 会员
    wallet: EMPTY_WALLET,
    // 加载失败时不显示一堆 0 冒充满钱包 —— 那会让用户以为金币真的没了
    walletLoaded: false,
    walletError: '',
    checkingIn: false,
    redeeming: false,
    ach: EMPTY_ACH,

    inviteOpen: false,
    invitePosterPath: '',
    invitePosterBusy: false
  },

  onShow: function () {
    if (bounceTeacherOffStudentShell()) return;
    dismissLoginOverlay();
    enableShareMenu();
    this._nickDraft = '';
    // 先用缓存铺上，否则每次切回本页头像昵称都会空一下再出现
    this.applyProfile(getCachedProfile());
    this.loadProfile();
    this.loadStats();
    this.loadWallet();
  },

  applyProfile: function (p) {
    // 已落库的昵称单独记一份：输入框绑定的 nickName 会随打字变，
    // 保存时不能拿它判断「有没有改」，否则必命中「昵称没有变化」
    this._savedNickName = p.nickName || '';
    this.setData({
      openId: p.openId,
      nickName: p.nickName,
      avatarFileID: p.avatarFileID,
      stage: p.stage,
      hasProfile: p.hasProfile
    });
  },

  // 打卡与金币。纯读，不发币
  loadWallet: function () {
    this.setData({ walletError: '' });
    return this.callCloud('user', { action: 'getWallet' }, 20000)
      .then((res) => {
        if (!res.success) throw new Error(res.error || '读取失败');
        this.setData({
          wallet: decorateWallet(res.data),
          walletLoaded: true,
          ach: buildAchievements(res.data)
        });
      })
      .catch((err) => {
        console.error('[profile] 读取钱包失败', err);
        this.setData({
          walletLoaded: false,
          walletError: isAccessTokenError(err)
            ? '云开发未登录，请重进小程序'
            : '打卡与金币加载失败'
        });
      });
  },

  onCheckin: function () {
    if (this.data.checkingIn || !this.data.walletLoaded) return;
    this.setData({ checkingIn: true });

    this.callCloud('user', { action: 'checkin' }, 30000)
      .then((res) => {
        if (!res.success) throw new Error(res.error || '打卡失败');
        const d = res.data || {};
        this.setData({
          wallet: decorateWallet(d),
          checkingIn: false,
          ach: buildAchievements(d)
        });
        if (d.alreadyChecked) {
          // 并发连点时后到的那次会走到这里，不是错误，如实说就行
          wx.showToast({ title: '今天已经打过卡了', icon: 'none' });
        } else {
          wx.showToast({ title: `打卡成功 +${d.rewarded} 金币`, icon: 'success' });
        }
      })
      .catch((err) => {
        this.setData({ checkingIn: false });
        console.error('[profile] 打卡失败', err);
        wx.showToast({ title: err.message || '打卡失败，请重试', icon: 'none' });
      });
  },

  onRedeemVip: function () {
    const w = this.data.wallet || {};
    if (this.data.redeeming || !this.data.walletLoaded) return;

    if (!w.canRedeem) {
      wx.showToast({ title: `还差 ${w.coinGap} 金币`, icon: 'none' });
      return;
    }

    // 花金币是不可逆的，兑换前把消耗和得到说清楚
    wx.showModal({
      title: w.isVip ? '续期会员' : '兑换会员',
      content: `消耗 ${w.vipCost} 金币，兑换 ${w.vipDays} 天对话会员。\n\n会员期间 AI 对话不限量。\n\n当前金币：${w.coins}`,
      confirmText: '兑换',
      success: (res) => {
        if (res.confirm) this.doRedeemVip();
      }
    });
  },

  doRedeemVip: function () {
    this.setData({ redeeming: true });
    wx.showLoading({ title: '兑换中...', mask: true });

    this.callCloud('user', { action: 'redeemVip' }, 30000)
      .then((res) => {
        if (!res.success) throw new Error(res.error || '兑换失败');
        wx.hideLoading();
        this.setData({ redeeming: false });
        wx.showToast({
          title: `会员已到 ${formatCnDate(res.data.vipExpireAt)}`,
          icon: 'success'
        });
        // 重新拉一次拿完整的钱包状态（余额、到期时间都变了）
        this.loadWallet();
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ redeeming: false });
        console.error('[profile] 兑换会员失败', err);
        wx.showToast({ title: err.message || '兑换失败，请重试', icon: 'none' });
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

  onPickAvatar: function () {
    if (this.data.uploadingAvatar) return;
    pickAvatarPhoto()
      .then((path) => this.uploadAvatar(path))
      .catch((err) => {
        if (isCancel(err)) return;
        wx.showToast({ title: '选图失败，请重试', icon: 'none' });
      });
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

  onSaveProfile: function (e) {
    if (this.data.saving) return;

    const fromForm = ((e.detail.value && e.detail.value.nickName) || '').trim();
    const fromLive = (this.data.nickName || '').trim();
    const fromDraft = (this._nickDraft || '').trim();
    const nickName = fromForm || fromLive || fromDraft;

    if (!nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    if ([...nickName].length > MAX_NICKNAME_LEN) {
      wx.showToast({ title: `昵称不能超过 ${MAX_NICKNAME_LEN} 个字`, icon: 'none' });
      return;
    }
    if (nickName === (this._savedNickName || '').trim()) {
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

    wx.showModal({
      title: '注销账号',
      content: '将永久删除本账号下的：\n· 个人资料（头像、昵称、学段、身份）\n· 全部错题与分类\n· 加入的班级记录与作业提交\n· 全部 AI 对话记忆\n· 全部试卷\n· 打卡记录、金币与会员\n· 错题收藏、置顶与笔记\n· 学习报告\n\n删除后无法恢复。同一微信再次登录需要重新选择学生或老师。',
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
      content: '再次确认删除全部云端数据？\n\n微信账号不受影响。注销后同一微信可以重新选择学生或老师。',
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

    performDeleteAccount()
      .then((res) => {
        this.setData({ deleting: false });
        wx.hideLoading();
        finishDeleteAccount(res);
      })
      .catch((err) => {
        this.setData({ deleting: false });
        wx.hideLoading();
        console.error('[profile] 注销失败', err);
        wx.showToast({ title: err.message || '注销失败，请重试', icon: 'none' });
      });
  },

  onLogout: function () {
    wx.showModal({
      title: '退出登录',
      content: '退出后不会删除云端数据。下次登录可重新选择学生或老师。',
      confirmText: '退出',
      success: (res) => {
        if (!res.confirm) return;
        // 只清本地登录态。资料缓存留给登录页展示头像昵称，
        // 同一微信下次进来仍是「欢迎回来」，不是一份空白新账号。
        clearSession();
        app.globalData.selectedPaperQuestions = [];
        app.globalData.recognitionDraft = null;
        goLogin({ force: true });
      }
    });
  },

  onMedalTap: function (e) {
    const id = e.currentTarget.dataset.id;
    const medals = (this.data.ach && this.data.ach.medals) || [];
    const medal = medals.filter((m) => m.id === id)[0];
    if (!medal) return;
    wx.showModal({
      title: medal.name,
      content: medal.unlocked
        ? medal.desc + '\n\n已点亮'
        : medal.desc + '\n\n未点亮：' + medal.hint,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  goCategories: function () {
    wx.switchTab({ url: '/pages/categories/categories' });
  },

  joinClass: function () {
    wx.showModal({
      title: '申请加入班级',
      editable: true,
      placeholderText: '输入老师给的班级加入码',
      confirmText: '申请',
      success: (res) => {
        if (!res.confirm || !res.content.trim()) return;
        wx.cloud.callFunction({
          name: 'teacher',
          data: { action: 'joinClass', joinCode: res.content.trim() },
          success: (result) => {
            const body = result.result || {};
            if (!body.success) {
              wx.showToast({ title: body.error || '申请失败', icon: 'none' });
              return;
            }
            const data = body.data || {};
            const title = data.alreadyJoined ? '你已在班级中' : (data.pending ? '已提交申请' : '加入成功');
            wx.showToast({ title, icon: 'success' });
          },
          fail: () => wx.showToast({ title: '申请失败，请稍后重试', icon: 'none' })
        });
      }
    });
  },

  goClasses: function () {
    wx.navigateTo({ url: '/pages/classes/classes' });
  },

  goLeaderboard: function () {
    wx.navigateTo({ url: '/pages/leaderboard/leaderboard' });
  },

  goLearningReport: function () {
    wx.navigateTo({ url: '/pages/learningReport/learningReport' });
  },

  goMistakeReports: function () {
    wx.navigateTo({ url: '/pages/reportList/reportList' });
  },

  goVariantList: function () {
    wx.navigateTo({ url: '/pages/variantList/variantList' });
  },

  onInviteTap: function () {
    this._inviteToken = Date.now();
    const token = this._inviteToken;
    this.setData({
      inviteOpen: true,
      invitePosterPath: '',
      invitePosterBusy: true
    }, () => {
      const opts = {
        nickName: this.data.nickName || '同学',
        avatarFileID: this.data.avatarFileID || '',
        levelName: (this.data.ach && this.data.ach.levelName) || ''
      };
      renderInvitePoster('invitePoster', opts)
        .then((path) => {
          if (this._inviteToken !== token || !this.data.inviteOpen) return;
          this.setData({ invitePosterPath: path, invitePosterBusy: false });
        })
        .catch((err) => {
          console.error('[profile] 生成邀请图失败', err);
          if (this._inviteToken !== token) return;
          this.setData({ invitePosterBusy: false });
          wx.showToast({ title: '邀请图生成失败，仍可转发', icon: 'none' });
        });
    });
  },

  closeInvite: function () {
    this._inviteToken = 0;
    this.setData({ inviteOpen: false, invitePosterBusy: false });
  },

  noop: function () {},

  onSaveInvitePoster: function () {
    const path = this.data.invitePosterPath;
    if (!path) {
      wx.showToast({
        title: this.data.invitePosterBusy ? '正在生成邀请图…' : '邀请图还没好',
        icon: 'none'
      });
      return;
    }
    // 不能先出 loading 遮罩：系统相册授权弹窗会被挡住，点了就像保存失败。
    savePosterToAlbum(path)
      .then(() => {
        wx.showToast({ title: '已保存到相册', icon: 'success' });
      })
      .catch((err) => {
        const hint = saveFailHint(err);
        if (!hint) return;
        wx.showToast({ title: hint, icon: 'none', duration: 2500 });
      });
  },

  // 打卡分享。分享的动机必须是内容本身，不能是奖励 ——
  // 微信《滥用分享行为》2.1 明确禁止「完成分享操作立即可获得积分/金币」。
  onShareAppMessage: function (res) {
    const streak = (this.data.wallet || {}).checkinStreak || 0;
    const kind = res && res.target && res.target.dataset && res.target.dataset.kind;
    if (kind === 'checkin') return checkinCard(streak);
    if (kind === 'invite') {
      const card = inviteCard();
      if (this.data.invitePosterPath) card.imageUrl = this.data.invitePosterPath;
      return card;
    }
    return streak > 0 ? checkinCard(streak) : inviteCard();
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
