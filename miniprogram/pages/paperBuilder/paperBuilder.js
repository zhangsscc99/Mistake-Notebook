// pages/paperBuilder/paperBuilder.js
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    title: '期末复习冲刺试卷',
    duration: 120,
    totalScore: 100,
    selectedQuestions: [],
    generating: false
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 微信小程序中推荐使用全局数据（GlobalData）或者路由传参来跨页面共享所选题目
    if (app.globalData.selectedPaperQuestions) {
      this.setData({
        selectedQuestions: app.globalData.selectedPaperQuestions
      });
    }
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
   * 时间改变
   */
  onDurationChange: function (e) {
    this.setData({
      duration: e.detail.value
    });
  },

  /**
   * 分数输入
   */
  onScoreInput: function (e) {
    this.setData({
      totalScore: parseInt(e.detail.value, 10) || 100
    });
  },

  /**
   * 去选择题目页面
   */
  goToSelector: function () {
    wx.navigateTo({
      url: '/pages/questionSelector/questionSelector'
    });
  },

  /**
   * 移除某个已添加题目
   */
  removeQuestion: function (e) {
    const index = e.currentTarget.dataset.index;
    const list = [...this.data.selectedQuestions];
    list.splice(index, 1);
    
    this.setData({
      selectedQuestions: list
    });

    app.globalData.selectedPaperQuestions = list;
  },

  /**
   * 生成试卷 PDF
   */
  generatePaper: function () {
    if (this.data.selectedQuestions.length === 0) {
      wx.showToast({
        title: '请先添加题目',
        icon: 'none'
      });
      return;
    }

    this.setData({ generating: true });

    const qIds = this.data.selectedQuestions.map(q => q.id);
    const requestData = {
      title: this.data.title,
      duration: this.data.duration,
      totalScore: this.data.totalScore,
      questionIds: qIds
    };

    wx.request({
      url: app.globalData.apiUrl + '/test-paper/generate',
      method: 'POST',
      data: requestData,
      responseType: 'arraybuffer', // PDF文件请求一般使用二进制流
      success: (res) => {
        this.setData({ generating: false });
        if (res.statusCode === 200) {
          this.saveAndOpenPdf(res.data);
        } else {
          this.useMockDownload();
        }
      },
      fail: () => {
        this.setData({ generating: false });
        this.useMockDownload();
      }
    });
  },

  /**
   * 保存二进制文件并调起手机文件浏览器打开
   */
  saveAndOpenPdf: function (arrayBuffer) {
    const fs = wx.getFileSystemManager();
    const filePath = wx.env.USER_DATA_PATH + `/${this.data.title}.pdf`;

    fs.writeFile({
      filePath: filePath,
      data: arrayBuffer,
      encoding: 'binary',
      success: () => {
        wx.showToast({
          title: '文件下载成功',
          icon: 'success'
        });
        
        // 使用微信自带原生文档查看器打开PDF
        setTimeout(() => {
          wx.openDocument({
            filePath: filePath,
            fileType: 'pdf',
            showMenu: true, // 允许转发、保存到手机等
            success: () => {
              console.log('PDF文档成功打开');
            },
            fail: (err) => {
              console.error('打开文档失败:', err);
            }
          });
        }, 1000);
      },
      fail: (err) => {
        console.error('写入临时文件失败:', err);
      }
    });
  },

  /**
   * 本地测试，展示生成逻辑演示
   */
  useMockDownload: function () {
    wx.showModal({
      title: '生成成功（演示）',
      content: `由于当前属于离线演示模式，无法直连本地 Spring Boot 服务的 /test-paper/generate。在真实服务器或本地后端运行时，这里会自动生成专属的 PDF 试卷文件并调用微信接口直接展示与分享、发送好友。`,
      confirmText: '我知道了',
      showCancel: false
    });
  }
});