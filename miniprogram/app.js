// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }

    wx.cloud.init({
      env: 'ai-mistake-notebook-d6byf98c0b95',
      traceUser: true
    });

    // 刷新登录态，避免 uploadFile 报 access_token missing
    wx.login({
      success: () => console.log('[app] 云开发登录态已刷新'),
      fail: (err) => console.warn('[app] wx.login 失败，上传可能受影响:', err)
    });

    // 全局数据，可用于存放用户信息等
    this.globalData = {
      userInfo: null,
      recognitionDraft: null,
      selectedPaperQuestions: [],
      categoriesMode: null,
      aiChatContext: ''
    };

    // 首次启动时初始化云数据库（创建默认分类）
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
  }
});