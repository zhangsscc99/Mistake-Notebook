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
    tagFilter: 'all',
    availableTags: [],
    accuracy: 0,
    editMode: false,
    isPaperSelectMode: false,
    selectedCount: 0,
    isAllSelected: false,
    groupByKnowledgePoint: true,
    knowledgePointGroups: [],
    expandedGroups: {},
    showDetailModal: false,
    detailQuestion: null
  },

  onLoad(options) {
    const id = options.id;
    const name = decodeURIComponent(options.name || '分类详情');
    const isPaperSelectMode = options.mode === 'paper-select';
    this.setData({
      categoryId: id,
      categoryName: name,
      categoryIcon: SYMBOL_MAP[name] || '题',
      isPaperSelectMode,
      editMode: isPaperSelectMode
    });
    wx.setNavigationBarTitle({ title: name });
    this.fetchQuestions(id, name);
  },

  onPullDownRefresh: function () {
    const id = this.data.categoryId;
    const name = this.data.categoryName;
    if (id) {
      this.fetchQuestions(id, name);
    }
    setTimeout(() => wx.stopPullDownRefresh(), 3000);
  },

  fetchQuestions(categoryId, categoryName) {
    wx.showLoading({ title: '加载中...' });
    wx.cloud.callFunction({
      name: 'question',
      data: { action: 'byCategory', categoryId: categoryId, categoryName: categoryName },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          const processed = res.result.data.map(q => ({
            ...q,
            difficultyClass: (q.difficulty || 'medium').toLowerCase(),
            difficultyText: q.difficulty === 'EASY' || q.difficulty === 'easy' ? '简单'
              : q.difficulty === 'HARD' || q.difficulty === 'hard' ? '困难' : '中等',
            formattedDate: q.createdAt ? q.createdAt.split('T')[0] : '2026-05-30',
            showAI: false,
            isCorrect: q.isCorrect || false,
            selected: false
          }));
          this.setData({ questions: processed });
          this.refreshTags();
          this.applyFilters();
          this.calcAccuracy();
          wx.stopPullDownRefresh();
        } else {
          this.useMockQuestions(categoryName);
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.stopPullDownRefresh();
        this.useMockQuestions(categoryName);
      }
    });
  },

  useMockQuestions(categoryName) {
    let mockList;
    if (categoryName.includes('数学')) {
      mockList = [
        { id: 101, content: '已知函数 f(x) = x² - 2x + 1，当 x ∈ [0, 3] 时，求 f(x) 的最大值与最小值。', difficulty: 'medium', difficultyClass: 'medium', difficultyText: '中等', formattedDate: '2026-05-28', tags: ['二次函数', '最值'], showAI: false, isCorrect: true, selected: false, aiAnswer: '最小值是 0，最大值是 4。', aiAnalysis: 'f(x) = (x - 1)². 当 x = 1 时，取得最小值 f(1) = 0. 当 x = 3 时，距离对称轴 x = 1 最远，取得最大值 f(3) = 4.' },
        { id: 102, content: '若集合 A = {x | x² - 3x + 2 = 0}，B = {x | 1 < x < 3}，求 A ∩ B。', difficulty: 'easy', difficultyClass: 'easy', difficultyText: '简单', formattedDate: '2026-05-29', tags: ['集合', '一元二次方程'], showAI: false, isCorrect: true, selected: false, aiAnswer: 'A ∩ B = {2}', aiAnalysis: '解方程 x² - 3x + 2 = 0 得 x = 1 或 x = 2，因此 A = {1, 2}. B = {x | 1 < x < 3}. 所以 A ∩ B = {2}.' }
      ];
    } else if (categoryName.includes('物理')) {
      mockList = [
        { id: 201, content: '一质量为 2kg 的物体在水平面上受到 10N 的水平推力，物体与水平面间的动摩擦因数为 0.2。求物体的加速度。（g取10m/s²）', difficulty: 'medium', difficultyClass: 'medium', difficultyText: '中等', formattedDate: '2026-05-27', tags: ['牛顿第二定律', '摩擦力'], showAI: false, isCorrect: false, selected: false, aiAnswer: '物体的加速度 a = 3 m/s²', aiAnalysis: '滑动摩擦力 f = μN = μmg = 0.2 * 2 * 10 = 4 N. 根据牛顿第二定律得：F - f = ma. a = (F - f) / m = (10 - 4) / 2 = 3 m/s².' }
      ];
    } else {
      mockList = [
        { id: 999, content: `这是 ${categoryName} 的示例错题。`, difficulty: 'easy', difficultyClass: 'easy', difficultyText: '简单', formattedDate: '2026-05-30', tags: ['示例'], showAI: false, isCorrect: true, selected: false, aiAnswer: '答案', aiAnalysis: '解析' }
      ];
    }
    this.setData({ questions: mockList });
    this.refreshTags();
    this.applyFilters();
    this.calcAccuracy();
  },

  refreshTags() {
    const tags = new Set();
    this.data.questions.forEach((q) => {
      (q.tags || []).forEach((tag) => tags.add(tag));
    });
    this.setData({ availableTags: Array.from(tags), tagFilter: 'all' });
  },

  buildKnowledgePointGroups(list) {
    const groups = new Map();
    list.forEach((q, listIndex) => {
      const points = (q.tags && q.tags.length > 0) ? q.tags : ['其他'];
      const key = points[0];
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push({ ...q, _listIndex: listIndex });
    });
    const expandedGroups = this.data.expandedGroups;
    return Array.from(groups.entries()).map(([name, questions]) => ({
      name,
      questions,
      count: questions.length,
      expanded: expandedGroups[name] !== false
    }));
  },

  toggleGroupByKnowledgePoint() {
    this.setData({ groupByKnowledgePoint: !this.data.groupByKnowledgePoint });
    this.applyFilters();
  },

  toggleGroup(e) {
    const name = e.currentTarget.dataset.name;
    const expandedGroups = { ...this.data.expandedGroups, [name]: !this.data.expandedGroups[name] };
    const knowledgePointGroups = this.data.knowledgePointGroups.map((g) =>
      g.name === name ? { ...g, expanded: expandedGroups[name] !== false } : g
    );
    this.setData({ expandedGroups, knowledgePointGroups });
  },

  applyFilters() {
    let list = [...this.data.questions];
    if (this.data.filterBy !== 'all') {
      list = list.filter(q => (q.difficulty || '').toLowerCase() === this.data.filterBy);
    }
    if (this.data.tagFilter !== 'all') {
      list = list.filter(q => (q.tags || []).includes(this.data.tagFilter));
    }
    if (this.data.sortBy === 'latest') {
      list.sort((a, b) => (b.formattedDate || '').localeCompare(a.formattedDate || ''));
    } else if (this.data.sortBy === 'earliest') {
      list.sort((a, b) => (a.formattedDate || '').localeCompare(b.formattedDate || ''));
    }
    const knowledgePointGroups = this.buildKnowledgePointGroups(list);
    this.setData({ displayQuestions: list, knowledgePointGroups });
    this.updateSelectionState();
  },

  calcAccuracy() {
    if (this.data.questions.length === 0) { this.setData({ accuracy: 0 }); return; }
    const correct = this.data.questions.filter(q => q.isCorrect).length;
    this.setData({ accuracy: Math.round((correct / this.data.questions.length) * 100) });
  },

  updateSelectionState() {
    const selectedCount = this.data.questions.filter(q => q.selected).length;
    const isAllSelected = this.data.questions.length > 0 && selectedCount === this.data.questions.length;
    this.setData({ selectedCount, isAllSelected });
  },

  getSelectedQuestions() {
    return this.data.questions.filter(q => q.selected);
  },

  setSort(e) {
    this.setData({ sortBy: e.currentTarget.dataset.sort });
    this.applyFilters();
  },

  setFilter(e) {
    this.setData({ filterBy: e.currentTarget.dataset.filter });
    this.applyFilters();
  },

  setTagFilter(e) {
    this.setData({ tagFilter: e.currentTarget.dataset.tag });
    this.applyFilters();
  },

  toggleEditMode() {
    const editMode = !this.data.editMode;
    const questions = this.data.questions.map(q => ({ ...q, selected: editMode ? q.selected : false }));
    this.setData({ editMode, questions });
    this.applyFilters();
  },

  toggleSelectAll() {
    const target = !this.data.isAllSelected;
    const questions = this.data.questions.map(q => ({ ...q, selected: target }));
    this.setData({ questions });
    this.applyFilters();
  },

  onQuestionTap(e) {
    if (!this.data.editMode) {
      this.viewQuestion(e);
      return;
    }
    const id = e.currentTarget.dataset.id;
    const questions = this.data.questions.map(q => (
      q.id === id ? { ...q, selected: !q.selected } : q
    ));
    this.setData({ questions });
    this.applyFilters();
  },

  onCheckboxChange(e) {
    const selectedIds = new Set((e.detail.value || []).map(String));
    const displayIds = new Set(this.data.displayQuestions.map(q => String(q.id)));
    const questions = this.data.questions.map(q => {
      if (displayIds.has(String(q.id))) {
        return { ...q, selected: selectedIds.has(String(q.id)) };
      }
      return q;
    });
    this.setData({ questions });
    this.applyFilters();
  },

  toggleAI(e) {
    const index = e.currentTarget.dataset.index;
    const qList = [...this.data.questions];
    qList[index].showAI = !qList[index].showAI;
    const dList = [...this.data.displayQuestions];
    const dIdx = dList.findIndex(q => q.id === qList[index].id);
    if (dIdx >= 0) dList[dIdx].showAI = qList[index].showAI;
    this.setData({ questions: qList, displayQuestions: dList });
  },

  previewImage(e) {
    wx.previewImage({ urls: [e.currentTarget.dataset.url] });
  },

  viewQuestion(e) {
    const item = this.data.displayQuestions[e.currentTarget.dataset.index];
    if (!item) return;
    this.setData({
      showDetailModal: true,
      detailQuestion: {
        id: item.id,
        content: item.content || '暂无内容',
        imageUrl: item.imageUrl || '',
        aiAnswer: item.aiAnswer || '待补充',
        aiAnalysis: item.aiAnalysis || 'AI暂未给出解析',
        tags: item.tags || [],
        difficultyText: item.difficultyText,
        difficultyClass: item.difficultyClass,
        formattedDate: item.formattedDate
      }
    });
  },

  closeDetailModal() {
    this.setData({ showDetailModal: false });
  },

  previewDetailImage(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ urls: [url] });
  },

  deleteQuestion(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: '确认删除',
      content: '是否确认将此错题从错题本中彻底移除？',
      success(res) {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中...' });
        wx.cloud.callFunction({
          name: 'question',
          data: { action: 'delete', id: id },
          success: () => {
            wx.hideLoading();
            that.removeQuestionById(id);
            wx.showToast({ title: '删除成功', icon: 'success' });
          },
          fail: () => {
            wx.hideLoading();
            that.removeQuestionById(id);
            wx.showToast({ title: '删除成功', icon: 'success' });
          }
        });
      }
    });
  },

  removeQuestionById(id) {
    const list = this.data.questions.filter(q => q.id !== id);
    this.setData({ questions: list });
    this.applyFilters();
    this.calcAccuracy();
  },

  goBackToHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  addToExam() {
    const selected = this.getSelectedQuestions();
    if (!selected.length) {
      if (!this.data.editMode) {
        this.setData({ editMode: true });
        wx.showToast({ title: '请勾选要加入的题目', icon: 'none' });
        return;
      }
      wx.showToast({ title: '请先选择题目', icon: 'none' });
      return;
    }
    this.savePaper();
  },

  savePaper() {
    const selected = this.getSelectedQuestions();
    if (!selected.length) {
      wx.showToast({ title: '请先选择题目', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '保存试卷',
      editable: true,
      placeholderText: '例如：数学第一次月考',
      content: `${this.data.categoryName}练习卷`,
      confirmText: '保存',
      success: (res) => {
        if (!res.confirm) return;
        const title = (res.content || '').trim();
        if (!title) {
          wx.showToast({ title: '请输入试卷名称', icon: 'none' });
          return;
        }

        const paper = {
          id: Date.now(),
          title,
          questionCount: selected.length,
          questions: selected.map(q => ({
            id: q.id,
            content: q.content,
            answer: q.aiAnswer || '待补充',
            analysis: q.aiAnalysis || 'AI暂未给出解析',
            categoryId: this.data.categoryId,
            categoryName: this.data.categoryName,
            tags: q.tags || [],
            difficulty: q.difficultyText || q.difficulty
          })),
          duration: 90,
          totalScore: selected.length * 5,
          createdAt: new Date().toLocaleDateString()
        };

        const persistLocal = () => {
          const papersJson = wx.getStorageSync('savedPapers');
          const papers = papersJson ? JSON.parse(papersJson) : [];
          papers.unshift(paper);
          wx.setStorageSync('savedPapers', JSON.stringify(papers));
        };

        wx.cloud.callFunction({
          name: 'paper',
          data: { action: 'save', paper },
          success: (cloudRes) => {
            if (cloudRes.result && cloudRes.result.success && cloudRes.result.data) {
              const cloudPaper = cloudRes.result.data;
              paper.id = cloudPaper.id || cloudPaper._id || paper.id;
            }
            try {
              persistLocal();
            } catch (e) {
              wx.showToast({ title: '本地保存失败', icon: 'none' });
              return;
            }
            this.afterPaperSaved();
          },
          fail: () => {
            try {
              persistLocal();
              wx.showToast({ title: '已本地保存', icon: 'none' });
            } catch (e) {
              wx.showToast({ title: '保存失败', icon: 'none' });
              return;
            }
            this.afterPaperSaved();
          }
        });
      }
    });
  },

  afterPaperSaved: function () {
    wx.showToast({ title: '试卷保存成功', icon: 'success' });

    if (this.data.isPaperSelectMode) {
      app.globalData.categoriesMode = null;
      setTimeout(() => {
        wx.switchTab({ url: '/pages/paperBuilder/paperBuilder' });
      }, 800);
    } else {
      const questions = this.data.questions.map(q => ({ ...q, selected: false }));
      this.setData({ questions, editMode: false });
      this.applyFilters();
    }
  },

  batchDelete() {
    const selected = this.getSelectedQuestions();
    if (!selected.length) {
      wx.showToast({ title: '请先选择题目', icon: 'none' });
      return;
    }

    const that = this;
    wx.showModal({
      title: '确认删除',
      content: `确定要删除选中的 ${selected.length} 道题目吗？`,
      success(res) {
        if (!res.confirm) return;
        const ids = selected.map(q => q.id);
        wx.showLoading({ title: '删除中...' });
        wx.cloud.callFunction({
          name: 'question',
          data: { action: 'batchDelete', ids },
          success: () => {
            wx.hideLoading();
            that.removeQuestionsByIds(ids);
            wx.showToast({ title: '删除成功', icon: 'success' });
          },
          fail: () => {
            wx.hideLoading();
            that.removeQuestionsByIds(ids);
            wx.showToast({ title: '删除成功', icon: 'success' });
          }
        });
      }
    });
  },

  removeQuestionsByIds(ids) {
    const idSet = new Set(ids);
    const list = this.data.questions.filter(q => !idSet.has(q.id));
    this.setData({ questions: list, editMode: false });
    this.applyFilters();
    this.calcAccuracy();
  },

  startPractice() {
    if (this.data.questions.length === 0) {
      wx.showToast({ title: '该分类暂无题目', icon: 'none' });
      return;
    }
    wx.showToast({ title: '开始练习功能即将上线', icon: 'none' });
  }
});
