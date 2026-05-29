// pages/settings/settings.js
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    hasUserInfo: false,
    apiUrl: 'http://localhost:8080/api'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    this.setData({
      apiUrl: app.globalData.apiUrl
    });
  },

  /**
   * 模拟获取微信用户信息
   */
  getUserProfile: function () {
    const that = this;
    if (wx.getUserProfile) {
      wx.getUserProfile({
        desc: '用于完善错题本用户资料',
        success: (res) => {
          that.setData({
            hasUserInfo: true
          });
          wx.showToast({ title: '登录成功', icon: 'success' });
        },
        fail: () => {
          // 如果拒绝，则也允许演示，保持原样
        }
      });
    } else {
      this.setData({
        hasUserInfo: true
      });
    }
  },

  /**
   * 修改后端服务地址
   */
  onApiUrlConfirm: function (e) {
    const value = e.detail.value;
    app.globalData.apiUrl = value;
    this.setData({
      apiUrl: value
    });
    wx.showToast({
      title: '后端地址已更新',
      icon: 'success'
    });
  },

  /**
   * 清除本地缓存
   */
  cleanCache: function () {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有本地临时选择、缓存的试卷列表等配置吗？',
      success: (res) => {
        if (res.confirm) {
          app.globalData.selectedPaperQuestions = [];
          wx.showToast({
            title: '清除成功',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 显示关于信息
   */
  showVersionInfo: function () {
    wx.showModal({
      title: '错题本小程序版',
      content: '基于原生微信小程序开发。支持一键拍照、AI OCR 识别、去手写笔迹、多学科自动归类、拼装试卷并极速导出 A4 打印版 PDF。2026年尊享版。',
      showCancel: false,
      confirmText: '极好'
    });
  }
});