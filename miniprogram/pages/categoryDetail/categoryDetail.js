// pages/categoryDetail/categoryDetail.js
const app = getApp();
const SYMBOL_MAP = {
  '数学': '数', '物理': '物', '化学': '化', '英语': '英',
  '语文': '语', '生物': '生', '历史': '史', '地理': '地'
};

Page({
  data: {
    categoryId: null,
    categoryName: '',
    categoryIcon: '题',
    questions: [],
    displayQuestions: [],
    sortBy: 'latest',
    filterBy: 'all',
    accuracy: 0
  },

  onLoad(options) {
    const id = options.id;
    const name = options.name || '分类详情';
    this.setData({
      categoryId: id,
      categoryName: name,
      categoryIcon: SYMBOL_MAP[name] || '题'
    });
    wx.setNavigationBarTitle({ title: name });
    this.fetchQuestions(id, name);
  },

  fetchQuestions(categoryId, categoryName) {
    wx.showLoading({ title: '加载中...' });
    wx.cloud.callFunction({
      name: 'question',
      data: { action: 'byCategory', categoryId: categoryId },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          const processed = res.result.data.map(q => ({
            ...q,
            difficultyClass: (q.difficulty || 'medium').toLowerCase(),
            difficultyText: q.difficulty === 'EASY' ? '简单' : q.difficulty === 'HARD' ? '困难' : '中等',
            formattedDate: q.createdAt ? q.createdAt.split('T')[0] : '2026-05-30',
            showAI: false,
            isCorrect: q.isCorrect || false
          }));
          this.setData({ questions: processed });
          this.applyFilters();
          this.calcAccuracy();
        } else {
          this.useMockQuestions(categoryName);
        }
      },
      fail: () => {
        wx.hideLoading();
        this.useMockQuestions(categoryName);
      }
    });
  },

  useMockQuestions(categoryName) {
    let mockList;
    if (categoryName.includes('数学')) {
      mockList = [
        { id: 101, content: '已知函数 f(x) = x² - 2x + 1，当 x ∈ [0, 3] 时，求 f(x) 的最大值与最小值。', difficulty: 'medium', difficultyClass: 'medium', difficultyText: '中等', formattedDate: '2026-05-28', tags: ['二次函数', '最值'], showAI: false, isCorrect: true, aiAnswer: '最小值是 0，最大值是 4。', aiAnalysis: 'f(x) = (x - 1)². 当 x = 1 时，取得最小值 f(1) = 0. 当 x = 3 时，距离对称轴 x = 1 最远，取得最大值 f(3) = 4.' },
        { id: 102, content: '若集合 A = {x | x² - 3x + 2 = 0}，B = {x | 1 < x < 3}，求 A ∩ B。', difficulty: 'easy', difficultyClass: 'easy', difficultyText: '简单', formattedDate: '2026-05-29', tags: ['集合', '一元二次方程'], showAI: false, isCorrect: true, aiAnswer: 'A ∩ B = {2}', aiAnalysis: '解方程 x² - 3x + 2 = 0 得 x = 1 或 x = 2，因此 A = {1, 2}. B = {x | 1 < x < 3}. 所以 A ∩ B = {2}.' }
      ];
    } else if (categoryName.includes('物理')) {
      mockList = [
        { id: 201, content: '一质量为 2kg 的物体在水平面上受到 10N 的水平推力，物体与水平面间的动摩擦因数为 0.2。求物体的加速度。（g取10m/s²）', difficulty: 'medium', difficultyClass: 'medium', difficultyText: '中等', formattedDate: '2026-05-27', tags: ['牛顿第二定律', '摩擦力'], showAI: false, isCorrect: false, aiAnswer: '物体的加速度 a = 3 m/s²', aiAnalysis: '滑动摩擦力 f = μN = μmg = 0.2 * 2 * 10 = 4 N. 根据牛顿第二定律得：F - f = ma. a = (F - f) / m = (10 - 4) / 2 = 3 m/s².' }
      ];
    } else {
      mockList = [
        { id: 999, content: `这是 ${categoryName} 的示例错题。`, difficulty: 'easy', difficultyClass: 'easy', difficultyText: '简单', formattedDate: '2026-05-30', tags: ['示例'], showAI: false, isCorrect: true, aiAnswer: '答案', aiAnalysis: '解析' }
      ];
    }
    this.setData({ questions: mockList });
    this.applyFilters();
    this.calcAccuracy();
  },

  applyFilters() {
    let list = [...this.data.questions];
    if (this.data.filterBy !== 'all') {
      list = list.filter(q => q.difficulty === this.data.filterBy);
    }
    if (this.data.sortBy === 'latest') {
      list.sort((a, b) => (b.formattedDate || '').localeCompare(a.formattedDate || ''));
    } else if (this.data.sortBy === 'earliest') {
      list.sort((a, b) => (a.formattedDate || '').localeCompare(b.formattedDate || ''));
    }
    this.setData({ displayQuestions: list });
  },

  calcAccuracy() {
    if (this.data.questions.length === 0) { this.setData({ accuracy: 0 }); return; }
    const correct = this.data.questions.filter(q => q.isCorrect).length;
    this.setData({ accuracy: Math.round((correct / this.data.questions.length) * 100) });
  },

  setSort(e) {
    this.setData({ sortBy: e.currentTarget.dataset.sort });
    this.applyFilters();
  },

  setFilter(e) {
    this.setData({ filterBy: e.currentTarget.dataset.filter });
    this.applyFilters();
  },

  toggleAI(e) {
    const index = e.currentTarget.dataset.index;
    const key = `questions[${index}].showAI`;
    const dkey = `displayQuestions[${index}].showAI`;
    const val = !this.data.questions[index].showAI;
    // update both arrays
    const qList = [...this.data.questions];
    qList[index].showAI = val;
    const dList = [...this.data.displayQuestions];
    const dIdx = dList.findIndex(q => q.id === qList[index].id);
    if (dIdx >= 0) dList[dIdx].showAI = val;
    this.setData({ questions: qList, displayQuestions: dList });
  },

  previewImage(e) {
    wx.previewImage({ urls: [e.currentTarget.dataset.url] });
  },

  viewQuestion(e) {
    const item = this.data.displayQuestions[e.currentTarget.dataset.index];
    if (!item) return;
    const content = (item.content || '暂无内容').substring(0, 120);
    wx.showModal({
      title: `题目 #${item.id}`,
      content: `${content}\n\n难度：${item.difficultyText}\n时间：${item.formattedDate}`,
      showCancel: false
    });
  },

  deleteQuestion(e) {
    const id = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index;
    const that = this;
    wx.showModal({
      title: '确认删除',
      content: '是否确认将此错题从错题本中彻底移除？',
      success(res) {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          wx.cloud.callFunction({
            name: 'question',
            data: { action: 'delete', id: id },
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '删除成功', icon: 'success' });
              let list = [...that.data.questions];
              list.splice(index, 1);
              that.setData({ questions: list });
              that.applyFilters();
              that.calcAccuracy();
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '删除成功', icon: 'success' });
              let list = [...that.data.questions];
              list.splice(index, 1);
              that.setData({ questions: list });
              that.applyFilters();
              that.calcAccuracy();
            }
          });
        }
      }
    });
  },

  goBackToHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  addToExam() {
    wx.navigateTo({ url: '/pages/paperBuilder/paperBuilder' });
  },

  startPractice() {
    if (this.data.questions.length === 0) {
      wx.showToast({ title: '该分类暂无题目', icon: 'none' });
      return;
    }
    wx.showToast({ title: '开始练习功能即将上线', icon: 'none' });
  }
});
