// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-d4g7l44nyca7c18e6',
        traceUser: true
      });
    }

    // 全局数据，可用于存放用户信息等
    this.globalData = {
      userInfo: null,
      recognitionDraft: null,
      selectedPaperQuestions: [],
      categoriesMode: null
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