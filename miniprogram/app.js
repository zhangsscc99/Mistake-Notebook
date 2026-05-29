// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        // 此处请填入您的微信云开发环境 ID，如：'prod-1gxxxxxx'
        env: '', 
        traceUser: true,
      });
    }

    // 全局数据，可用于存放用户信息等
    this.globalData = {
      userInfo: null,
      apiUrl: 'http://localhost:8080/api' // 本地开发后端接口地址（如果不使用云函数，也可以直连您的SpringBoot后端）
    };
  }
});