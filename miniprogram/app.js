// app.js
const { isLoggedIn, restoreSessionFromCloud } = require('./utils/auth');

App({
  // 全局数据声明在顶层，不能放进 onLaunch —— onLaunch 开头有个
  // `if (!wx.cloud) return`，一旦走到那条分支 globalData 就永远不会被赋值，
  // 而首页 / 对话页 / 设置页都要读它。
  globalData: {
    // 由 utils/profile.js 统一读写（服务端才是权威，这里只是缓存）
    profile: null,
    loggedIn: false,
    recognitionDraft: null,
    selectedPaperQuestions: [],
    categoriesMode: null,
    aiChatContext: ''
  },

  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }

    wx.cloud.init({
      env: 'ai-mistakenotebook-d7cw2be1433bd',
      traceUser: true
    });

    // 刷新登录态，避免 uploadFile 报 access_token missing
    wx.login({
      success: () => console.log('[app] 云开发登录态已刷新'),
      fail: (err) => console.warn('[app] wx.login 失败，上传可能受影响:', err)
    });

    // 本地标记丢了也从云端认回；认回后再 ensure 分类。
    this.ensureAccountIfKnown();

    // 只确保集合存在。默认分类改在登录时按账号创建，不再写入全局题库。
    setTimeout(() => {
      wx.cloud.callFunction({
        name: 'init',
        data: { action: 'seed' },
        success: (res) => {
          if (res.result && res.result.success) {
            console.log('云数据库初始化:', res.result.message || res.result.data);
          }
        },
        fail: (err) => {
          console.warn('云数据库初始化失败，请在开发者工具部署 init 云函数:', err);
        }
      });
    }, 1000);
  },

  ensureAccountIfKnown: function () {
    restoreSessionFromCloud().catch((err) => console.warn('[app] 恢复登录失败:', err));
  },

  onShow: function () {
    // 切 Tab / 从后台回来时只静默认回会话，绝不 reLaunch 到登录页。
    // 从对话等 tabBar 页 reLaunch 到非 tab 的登录页，微信会叠一层点不了的登录界面
    // （标题还是「对话助手」、底部 Tab 还在）。
    if (isLoggedIn()) return;
    restoreSessionFromCloud().catch((err) => {
      console.warn('[app] 恢复登录失败:', err);
    });
  }
});
