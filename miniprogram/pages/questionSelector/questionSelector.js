// pages/questionSelector/questionSelector.js
// 此页面已被新流程替代：paperBuilder -> categories(paper-builder mode) -> categoryDetail(paper-select mode)
// 保留此文件防止 app.json 报错，onLoad 直接跳转到分类页走新流程
const app = getApp();

Page({
  data: {
    categories: [],
    activeTabId: null,
    questions: [],
    selectedTempCount: 0,
    selectedIds: [],
    allLoadedQuestions: []
  },

  onLoad: function (options) {
    // 新流程：设置组卷模式后跳转到分类 Tab
    app.globalData.categoriesMode = 'paper-builder';
    wx.switchTab({ url: '/pages/categories/categories' });
  },

  _onLoad_legacy: function (options) {
    this.fetchCategories();
    // 读取已经勾选进去的题目，便于在 selector 里默认打上勾
    const alreadySelected = app.globalData.selectedPaperQuestions || [];
    this.setData({
      selectedIds: alreadySelected.map(q => q.id.toString()),
      selectedTempCount: alreadySelected.length
    });
  },

  /**
   * 获取学科分类列表
   */
  fetchCategories: function () {
    const that = this;
    wx.cloud.callFunction({
      name: 'category',
      data: { action: 'list' },
      success: (res) => {
        if (res.result && res.result.success) {
          const cats = res.result.data;
          that.setData({
            categories: cats,
            activeTabId: cats[0] ? cats[0].id : 1
          });
          that.fetchQuestionsByCategory(cats[0] ? cats[0].id : 1);
        } else {
          that.useMockData();
        }
      },
      fail: () => {
        that.useMockData();
      }
    });
  },

  /**
   * 采用模拟数据
   */
  useMockData: function () {
    const mockCats = [
      { id: 1, name: '数学' },
      { id: 2, name: '物理' },
      { id: 3, name: '化学' },
      { id: 4, name: '英语' },
      { id: 5, name: '语文' }
    ];
    this.setData({
      categories: mockCats,
      activeTabId: 1
    });
    this.fetchQuestionsByCategory(1);
  },

  /**
   * 按分类查询错题列表
   */
  fetchQuestionsByCategory: function (categoryId) {
    const that = this;
    wx.showLoading({ title: '加载错题...' });

    wx.cloud.callFunction({
      name: 'question',
      data: { action: 'byCategory', categoryId: categoryId },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          that.processQuestions(res.result.data);
        } else {
          that.useMockQuestions(categoryId);
        }
      },
      fail: () => {
        wx.hideLoading();
        that.useMockQuestions(categoryId);
      }
    });
  },

  /**
   * 模拟分类的错题
   */
  useMockQuestions: function (categoryId) {
    let mockList = [];
    if (categoryId === 1) { // 数学
      mockList = [
        { id: 101, content: '已知函数 f(x) = x² - 2x + 1，当 x ∈ [0, 3] 时，求 f(x) 的最大值与最小值。', difficulty: 'MEDIUM' },
        { id: 102, content: '若集合 A = {x | x² - 3x + 2 = 0}，B = {x | 1 < x < 3}，求 A ∩ B。', difficulty: 'EASY' },
        { id: 103, content: '已知圆的方程为 x² + y² = 4，直线方程为 y = kx + 3。当直线与圆相切时，求斜率 k 的值。', difficulty: 'HARD' }
      ];
    } else if (categoryId === 2) { // 物理
      mockList = [
        { id: 201, content: '一质量为 2kg 的物体在水平面上受到 10N 的水平推力，物体与水平面间的动摩擦因数为 0.2。求物体的加速度。（g取10m/s²）', difficulty: 'MEDIUM' }
      ];
    } else {
      mockList = [
        { id: 901, content: '这是一道测试学科的错题，仅在连接真实后端前展示。', difficulty: 'EASY' }
      ];
    }

    this.processQuestions(mockList);
  },

  /**
   * 处理题目字段 (格式化属性)
   */
  processQuestions: function (rawList) {
    const that = this;
    const processed = rawList.map(q => {
      return {
        ...q,
        difficultyClass: (q.difficulty || 'medium').toLowerCase(),
        difficultyText: q.difficulty === 'EASY' ? '简单' : q.difficulty === 'HARD' ? '困难' : '中等',
        checked: that.data.selectedIds.includes(q.id.toString())
      };
    });

    // 把获取过的错题合并缓存起来，以便于在跨 Tab 或最终点击“确认”时能够组装成包含完整内容（例如：content）的题目对象返回
    const tempAll = [...this.data.allLoadedQuestions];
    processed.forEach(pq => {
      if (!tempAll.find(item => item.id === pq.id)) {
        tempAll.push(pq);
      }
    });

    this.setData({
      questions: processed,
      allLoadedQuestions: tempAll
    });
  },

  /**
   * 切换学科分类 Tab
   */
  switchTab: function (e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      activeTabId: id
    });
    this.fetchQuestionsByCategory(id);
  },

  /**
   * 复选框状态变更
   */
  onCheckboxChange: function (e) {
    const selectedValues = e.detail.value; // 选中的 id 字符串数组
    
    // 更新当前列表中每个题目的 checked 状态
    const updatedQuestions = this.data.questions.map(q => {
      return {
        ...q,
        checked: selectedValues.includes(q.id.toString())
      };
    });

    // 汇总所有被勾选的 ID (包含以前选的但由于跨 Tab 切换没在当前页面显示的那些)
    let currentTabIds = this.data.questions.map(q => q.id.toString());
    let otherTabSelectedIds = this.data.selectedIds.filter(id => !currentTabIds.includes(id));
    let totalSelectedIds = [...otherTabSelectedIds, ...selectedValues];

    this.setData({
      questions: updatedQuestions,
      selectedIds: totalSelectedIds,
      selectedTempCount: totalSelectedIds.length
    });
  },

  /**
   * 确认选择并返回上一页
   */
  confirmSelection: function () {
    const that = this;
    // 根据选中的 ID 汇总其题目完整信息
    const fullSelectedQuestions = this.data.allLoadedQuestions.filter(q => 
      that.data.selectedIds.includes(q.id.toString())
    );

    // 把选中的题目挂载到全局 globalData 传递回 paperBuilder 页面
    app.globalData.selectedPaperQuestions = fullSelectedQuestions;

    wx.navigateBack({
      delta: 1,
      success: () => {
        wx.showToast({
          title: `成功添加 ${fullSelectedQuestions.length} 题`,
          icon: 'success'
        });
      }
    });
  }
});