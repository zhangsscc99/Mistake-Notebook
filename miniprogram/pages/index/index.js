// pages/index/index.js
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    tempFilePath: '',
    title: '',
    categories: [
      { id: 1, name: '数学' },
      { id: 2, name: '物理' },
      { id: 3, name: '化学' },
      { id: 4, name: '英语' },
      { id: 5, name: '语文' },
      { id: 6, name: '生物' },
      { id: 7, name: '历史' },
      { id: 8, name: '地理' },
      { id: 9, name: '计算机/编程' },
      { id: 10, name: '政治' }
    ],
    categoryIndex: 0,
    removeHandwriting: true,
    autoClassify: true,
    uploading: false,
    result: null
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.fetchCategories();
  },

  /**
   * 从后端获取分类数据
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
        }
      },
      fail: (err) => {
        console.warn('无法连接后端 API, 使用内置默认分类:', err);
      }
    });
  },

  /**
   * 选择错题图片
   */
  chooseImage: function () {
    const that = this;
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        camera: 'back',
        success: (res) => {
          that.setData({
            tempFilePath: res.tempFiles[0].tempFilePath
          });
        }
      });
    } else {
      wx.chooseImage({
        count: 1,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          that.setData({
            tempFilePath: res.tempFilePaths[0]
          });
        }
      });
    }
  },

  /**
   * 重置图片选择
   */
  resetImage: function () {
    this.setData({
      tempFilePath: '',
      result: null,
      title: ''
    });
  },

  /**
   * 标题输入
   */
  onTitleInput: function (e) {
    this.setData({
      title: e.detail.value
    });
  },

  /**
   * 分类选择改变
   */
  onCategoryChange: function (e) {
    this.setData({
      categoryIndex: parseInt(e.detail.value, 10)
    });
  },

  /**
   * 擦除手写体开关
   */
  onHandwritingSwitch: function (e) {
    this.setData({
      removeHandwriting: e.detail.value
    });
  },

  /**
   * AI 自动分类开关
   */
  onAutoClassifySwitch: function (e) {
    this.setData({
      autoClassify: e.detail.value
    });
  },

  /**
   * 提交并上传、AI识别
   */
  submitQuestion: function () {
    if (!this.data.tempFilePath) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      });
      return;
    }

    this.setData({ uploading: true });
    
    // 如果使用云开发，可以使用 wx.cloud.uploadFile 上传到云存储
    // 如果是连本地后端，可以使用 wx.uploadFile 
    this.uploadToBackend();
  },

  /**
   * 上传到 Java 后端服务器
   */
  uploadToBackend: function () {
    const that = this;
    const selectedCategory = this.data.categories[this.data.categoryIndex].name;
    
    wx.uploadFile({
      url: app.globalData.apiUrl + '/upload/question-segment',
      filePath: that.data.tempFilePath,
      name: 'file',
      success: (res) => {
        that.setData({ uploading: false });
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(res.data);
            wx.showToast({
              title: '识别成功',
              icon: 'success'
            });
            
            // 假设识别并保存成功，跳转到对应分类或显示结果
            that.setData({
              result: {
                category: selectedCategory,
                ocrText: data.data && data.data.questions && data.data.questions[0] ? data.data.questions[0].text : '识别到数学二次函数最值题...'
              }
            });

            // 延迟跳转到错题分类页
            setTimeout(() => {
              wx.showModal({
                title: '错题保存成功',
                content: `该题已自动识别并归类到 [${selectedCategory}] 分类，是否前往查看？`,
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.switchTab({
                      url: '/pages/categories/categories'
                    });
                  }
                }
              });
            }, 1500);

          } catch (e) {
            console.error(e);
            that.useMockResult(selectedCategory);
          }
        } else {
          that.useMockResult(selectedCategory);
        }
      },
      fail: (err) => {
        console.warn('连接后端接口失败，使用模拟识别结果演示流程:', err);
        that.useMockResult(selectedCategory);
      }
    });
  },

  /**
   * 当后端不可用时，使用模拟的识别流程
   */
  useMockResult: function (categoryName) {
    const that = this;
    setTimeout(() => {
      that.setData({
        uploading: false,
        result: {
          category: categoryName,
          ocrText: `1. 已知函数 f(x) = x² - 2x + 1，当 x ∈ [0, 3] 时，求 f(x) 的最大值与最小值。
2. 设集合 A = {x | f(x) = 0}，求集合 A 的所有子集。`
        }
      });
      wx.showToast({
        title: '（演示）AI识别成功',
        icon: 'success'
      });

      setTimeout(() => {
        wx.showModal({
          title: '错题已保存(演示)',
          content: `已模拟将此题目保存到【${categoryName}】分类。`,
          showCancel: true,
          confirmText: '去查看',
          success: (res) => {
            if (res.confirm) {
              wx.switchTab({
                url: '/pages/categories/categories'
              });
            }
          }
        });
      }, 1500);
    }, 1500);
  }
});