// pages/categories/categories.js
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    totalQuestions: 0,
    todayAdded: 0,
    masteredCount: 0,
    categories: []
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.fetchStats();
    this.fetchCategories();
  },

  /**
   * 获取错题统计信息
   */
  fetchStats: function () {
    const that = this;
    wx.request({
      url: app.globalData.apiUrl + '/categories/stats',
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          that.setData({
            totalQuestions: res.data.totalQuestions || 0,
            todayAdded: res.data.todayAdded || 0,
            masteredCount: res.data.masteredCount || 0
          });
        } else {
          that.setMockStats();
        }
      },
      fail: () => {
        that.setMockStats();
      }
    });
  },

  /**
   * 获取分类列表
   */
  fetchCategories: function () {
    const that = this;
    wx.request({
      url: app.globalData.apiUrl + '/categories',
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          that.setData({
            categories: res.data
          });
        } else {
          that.setMockCategories();
        }
      },
      fail: () => {
        that.setMockCategories();
      }
    });
  },

  /**
   * 设置模拟统计数据
   */
  setMockStats: function () {
    this.setData({
      totalQuestions: 42,
      todayAdded: 3,
      masteredCount: 15
    });
  },

  /**
   * 设置模拟分类数据
   */
  setMockCategories: function () {
    this.setData({
      categories: [
        { id: 1, name: '数学', description: '高数、代数、几何错题等', color: '#E8A855', questionCount: 15 },
        { id: 2, name: '物理', description: '力学、电磁学、光学、热学等', color: '#4A90E2', questionCount: 10 },
        { id: 3, name: '化学', description: '无机、有机、化学反应平衡等', color: '#7ED321', questionCount: 6 },
        { id: 4, name: '英语', description: '阅读理解、完形填空、语法填空等', color: '#F5A623', questionCount: 8 },
        { id: 5, name: '语文', description: '文言文阅读、诗歌鉴赏、现代文等', color: '#BD10E0', questionCount: 3 }
      ]
    });
  },

  /**
   * 跳转到分类详情页
   */
  goToDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    wx.navigateTo({
      url: `/pages/categoryDetail/categoryDetail?id=${id}&name=${name}`
    });
  }
});