// app.js
const { isLoggedIn, goLogin } = require('./utils/auth');

App({
  // 全局数据声明在顶层，不能放进 onLaunch —— onLaunch 开头有个
  // `if (!wx.cloud) return`，一旦走到那条分支 globalData 就永远不会被赋值，
  // 而首页 / 对话页 / 设置页都要读它。
  globalData: {
    // 由 utils/profile.js 统一读写（服务端才是权威，这里只是缓存）
    profile: null,
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

    // 本地已登录但云端可能还没有用户档/默认分类（旧会话、跳过登录页）。
    // 补一次 ensure，避免题目写下之后在「分类」里找不到文件夹。
    if (isLoggedIn()) {
      wx.cloud.callFunction({
        name: 'user',
        data: { action: 'ensure' },
        fail: (err) => console.warn('[app] ensure 账号失败:', err)
      });
    }

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

  onShow: function () {
    const pages = getCurrentPages();
    const cur = pages[pages.length - 1];
    if (cur && cur.route === 'pages/login/login') return;
    if (!isLoggedIn()) goLogin();
  }
});