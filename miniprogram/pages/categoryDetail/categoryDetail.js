// pages/categoryDetail/categoryDetail.js
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    categoryId: null,
    categoryName: '',
    questions: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const id = options.id;
    const name = options.name || '分类详情';
    
    this.setData({
      categoryId: id,
      categoryName: name
    });

    wx.setNavigationBarTitle({
      title: name
    });

    this.fetchQuestions(id, name);
  },

  /**
   * 获取当前分类下的错题列表
   */
  fetchQuestions: function (categoryId, categoryName) {
    const that = this;
    wx.showLoading({ title: '加载中...' });

    wx.request({
      url: app.globalData.apiUrl + `/questions/by-category/${categoryId}`,
      method: 'GET',
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200 && res.data) {
          // 处理返回的数据格式
          const processed = res.data.map(q => {
            return {
              ...q,
              difficultyClass: (q.difficulty || 'medium').toLowerCase(),
              difficultyText: q.difficulty === 'EASY' ? '简单' : q.difficulty === 'HARD' ? '困难' : '中等',
              formattedDate: q.createdAt ? q.createdAt.split('T')[0] : '2026-05-30',
              showAI: false
            };
          });
          that.setData({
            questions: processed
          });
        } else {
          that.useMockQuestions(categoryName);
        }
      },
      fail: () => {
        wx.hideLoading();
        that.useMockQuestions(categoryName);
      }
    });
  },

  /**
   * 采用模拟的错题列表
   */
  useMockQuestions: function (categoryName) {
    let mockList = [];
    if (categoryName.includes('数学')) {
      mockList = [
        {
          id: 101,
          content: '已知函数 f(x) = x² - 2x + 1，当 x ∈ [0, 3] 时，求 f(x) 的最大值与最小值。',
          difficultyClass: 'medium',
          difficultyText: '中等',
          formattedDate: '2026-05-28',
          tags: ['二次函数', '最值'],
          showAI: false,
          aiAnswer: '最小值是 0，最大值是 4。',
          aiAnalysis: 'f(x) = (x - 1)². 当 x = 1 时，取得最小值 f(1) = 0. 当 x = 3 时，距离对称轴 x = 1 最远，取得最大值 f(3) = 4.'
        },
        {
          id: 102,
          content: '若集合 A = {x | x² - 3x + 2 = 0}，B = {x | 1 < x < 3}，求 A ∩ B。',
          difficultyClass: 'easy',
          difficultyText: '简单',
          formattedDate: '2026-05-29',
          tags: ['集合', '一元二次方程'],
          showAI: false,
          aiAnswer: 'A ∩ B = {2}',
          aiAnalysis: '解方程 x² - 3x + 2 = 0 得 x = 1 或 x = 2，因此 A = {1, 2}. B = {x | 1 < x < 3}. 所以 A ∩ B = {2}.'
        }
      ];
    } else if (categoryName.includes('物理')) {
      mockList = [
        {
          id: 201,
          content: '一质量为 2kg 的物体在水平面上受到 10N 的水平推力，物体与水平面间的动摩擦因数为 0.2。求物体的加速度。（g取10m/s²）',
          difficultyClass: 'medium',
          difficultyText: '中等',
          formattedDate: '2026-05-27',
          tags: ['牛顿第二定律', '摩擦力'],
          showAI: false,
          aiAnswer: '物体的加速度 a = 3 m/s²',
          aiAnalysis: '滑动摩擦力 f = μN = μmg = 0.2 * 2 * 10 = 4 N. 根据牛顿第二定律得：F - f = ma. a = (F - f) / m = (10 - 4) / 2 = 3 m/s².'
        }
      ];
    } else {
      mockList = [
        {
          id: 999,
          content: `这是 ${categoryName} 的示例错题。在实际运行中，一旦连接并启动 Spring Boot 后端，小程序会自动请求真实的数据接口，展现您的本地错题库。`,
          difficultyClass: 'easy',
          difficultyText: '简单',
          formattedDate: '2026-05-30',
          tags: ['示例'],
          showAI: false,
          aiAnswer: '示例答案内容',
          aiAnalysis: '示例解析步骤...'
        }
      ];
    }

    this.setData({
      questions: mockList
    });
  },

  /**
   * 切换 AI 答案的显示与隐藏
   */
  toggleAI: function (e) {
    const index = e.currentTarget.dataset.index;
    const key = `questions[${index}].showAI`;
    this.setData({
      [key]: !this.data.questions[index].showAI
    });
  },

  /**
   * 预览大图
   */
  previewImage: function (e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      urls: [url]
    });
  },

  /**
   * 删除错题
   */
  deleteQuestion: function (e) {
    const id = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index;
    const that = this;

    wx.showModal({
      title: '确认删除',
      content: '是否确认将此错题从错题本中彻底移除？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          wx.request({
            url: app.globalData.apiUrl + `/questions/${id}`,
            method: 'DELETE',
            success: (resp) => {
              wx.hideLoading();
              wx.showToast({ title: '删除成功', icon: 'success' });
              
              const list = [...that.data.questions];
              list.splice(index, 1);
              that.setData({ questions: list });
            },
            fail: () => {
              wx.hideLoading();
              // 如果没有真实后端，本地模拟删除
              wx.showToast({ title: '（演示）删除成功', icon: 'success' });
              const list = [...that.data.questions];
              list.splice(index, 1);
              that.setData({ questions: list });
            }
          });
        }
      }
    });
  },

  /**
   * 返回拍照页面
   */
  goBackToHome: function () {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});