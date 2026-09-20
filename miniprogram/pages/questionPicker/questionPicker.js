const app = getApp();
const { STAGES, getCachedProfile } = require('../../utils/profile');
const { inferPeriodFromQuestions } = require('../../utils/stageGuess');

// 用户没设过学段、题文也看不出学段时的默认值
const DEFAULT_PERIOD = '高中';

// 用户在「我的」页设了学段就拿来当默认。
// 用同步的缓存读 —— 这里在 onLoad 里同步调用，不能等异步返回，
// 否则会和用户打开弹窗的时机赛跑
function preferredPeriod() {
  const stage = (getCachedProfile().stage || '').trim();
  return STAGES.indexOf(stage) === -1 ? DEFAULT_PERIOD : stage;
}

function isDifficultQuestion(segment) {
  const type = segment.type || '';
  const confidence = typeof segment.confidence === 'number' ? segment.confidence : 1;
  return type.includes('解答') || confidence < 0.85;
}

function getConfidenceLabel(confidence) {
  if (!confidence || confidence === 0) return '';
  if (confidence >= 0.9) return '简单';
  if (confidence >= 0.8) return '中等';
  return '困难';
}

function overlaysForPage(questions, pageIndex) {
  const overlays = [];
  (questions || []).forEach((q) => {
    const spans = q.pageSpans || [];
    const hit = spans.filter((span) => Number(span.pageIndex) === pageIndex && span.bounds);
    if (!hit.length && pageIndex === 0 && q.bounds && (!q.pageIndexes || !q.pageIndexes.length)) {
      overlays.push({ id: q.id, selected: q.selected, bounds: q.bounds });
      return;
    }
    hit.forEach((span) => {
      overlays.push({ id: q.id, selected: q.selected, bounds: span.bounds });
    });
  });
  return overlays.filter((item) => item.bounds);
}

Page({
  data: {
    imagePath: '',
    fileID: '',
    pages: [],
    pageCount: 0,
    currentPageIndex: 0,
    currentOverlays: [],
    questions: [],
    categories: [],
    selectedCategory: '',
    selectedCategoryId: '',
    selectedDifficulty: '中等',
    selectedPeriod: DEFAULT_PERIOD,
    difficulties: ['简单', '中等', '困难'],
    // 与「我的」页的学段共用一份列表，不再各写一个字面量
    periods: STAGES,
    selectedCount: 0,
    saving: false,
    saveLabel: '保存到错题本',
    showPickerModal: false,
    tempCategory: '',
    tempCategoryId: '',
    tempDifficulty: '中等',
    tempPeriod: DEFAULT_PERIOD
  },

  onLoad: function () {
    // 放在最前面：后面的 draft 检查失败会直接 navigateBack，无所谓；
    // 但成功路径上 selectedPeriod 必须已经就位（openCategoryPicker 会拿它重置 tempPeriod）
    const period = preferredPeriod();
    this.setData({ selectedPeriod: period, tempPeriod: period });

    const draft = app.globalData.recognitionDraft;
    if (!draft || !draft.segments || !draft.segments.length) {
      wx.showToast({ title: '无识别结果', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    const pages = Array.isArray(draft.pages) && draft.pages.length
      ? draft.pages.map((page) => ({
          tempFilePath: page.tempFilePath || page.path || '',
          fileID: page.fileID || ''
        }))
      : [{
          tempFilePath: draft.tempFilePath || '',
          fileID: draft.fileID || ''
        }];
    const fileIDs = Array.isArray(draft.fileIDs) && draft.fileIDs.length
      ? draft.fileIDs
      : pages.map((page) => page.fileID);

    const questions = draft.segments.map((segment, index) => {
      const conf = segment.confidence || 0;
      const pageSpans = Array.isArray(segment.pageSpans) && segment.pageSpans.length
        ? segment.pageSpans
        : [{ pageIndex: 0, bounds: segment.bounds || null }];
      const pageIndexes = pageSpans.map((span) => Number(span.pageIndex) || 0);
      const firstPage = pageIndexes[0] || 0;
      const isCrossPage = pageIndexes.length > 1;
      return {
        id: String(index + 1),
        text: segment.content || segment.text || '',
        type: segment.type || '',
        subject: segment.subject || '',
        period: segment.period || '',
        confidence: conf,
        confidenceLabel: getConfidenceLabel(conf),
        bounds: (pageSpans[0] && pageSpans[0].bounds) || segment.bounds || null,
        pageSpans,
        pageIndexes,
        isCrossPage,
        crossPageLabel: isCrossPage ? ('跨' + pageIndexes.length + '页') : '',
        imageUrl: fileIDs[firstPage] || draft.fileID || '',
        pageFileIDs: pageIndexes.map((i) => fileIDs[i]).filter(Boolean),
        selected: segment.isDifficult !== undefined
          ? !!segment.isDifficult
          : isDifficultQuestion(segment)
      };
    }).filter((q) => q.text);

    // 题文能看出来是大学（ODE / 高等数学等）时，覆盖资料里的「高中」默认
    const inferredPeriod = inferPeriodFromQuestions(questions, '');
    const period = inferredPeriod || this.data.selectedPeriod || preferredPeriod();

    this.setData({
      imagePath: (pages[0] && pages[0].tempFilePath) || draft.tempFilePath || '',
      fileID: (pages[0] && pages[0].fileID) || draft.fileID || '',
      pages,
      pageCount: pages.length,
      currentPageIndex: 0,
      currentOverlays: overlaysForPage(questions, 0),
      questions,
      selectedCount: questions.filter((q) => q.selected).length,
      selectedPeriod: period,
      tempPeriod: period
    });

    this.fetchCategories();
    if (draft.mode === 'parent_child') {
      wx.setNavigationBarTitle({ title: '保存到孩子错题本' });
      this.setData({ saveLabel: '保存到孩子错题本' });
    }
  },

  pickFromExistingCategories: function (categories, hint) {
    const list = categories || [];
    if (!list.length) return { name: '', id: '' };
    const want = String(hint || '').replace(/\s+/g, '');
    if (want) {
      const exact = list.find((c) => String(c.name || '').replace(/\s+/g, '') === want);
      if (exact) return { name: exact.name, id: exact._id || exact.id || '' };
      const fuzzy = list.find((c) => {
        const n = String(c.name || '').replace(/\s+/g, '');
        return n && (want.indexOf(n) !== -1 || n.indexOf(want) !== -1);
      });
      if (fuzzy) return { name: fuzzy.name, id: fuzzy._id || fuzzy.id || '' };
    }
    const first = list[0];
    return { name: first.name, id: first._id || first.id || '' };
  },

  applyCategoryList: function (categories) {
    const hint = (this.data.questions[0] && this.data.questions[0].subject) || this.data.selectedCategory;
    const picked = this.pickFromExistingCategories(categories, hint);
    this.setData({
      categories,
      selectedCategory: picked.name,
      selectedCategoryId: picked.id,
      tempCategory: picked.name,
      tempCategoryId: picked.id
    });
  },

  fetchCategories: function () {
    const draft = app.globalData.recognitionDraft || {};
    if (draft.mode === 'parent_child' && draft.studentId) {
      wx.cloud.callFunction({
        name: 'parent',
        data: { action: 'childCategories', studentId: draft.studentId },
        success: (res) => {
          const list = (res.result && res.result.success && res.result.data) || [];
          this.applyCategoryList(list);
        },
        fail: () => this.applyCategoryList([])
      });
      return;
    }
    wx.cloud.callFunction({
      name: 'category',
      data: { action: 'list' },
      success: (res) => {
        if (res.result && res.result.success && res.result.data.length) {
          this.applyCategoryList(res.result.data);
        } else {
          this.applyCategoryList([]);
        }
      },
      fail: () => {
        this.applyCategoryList([]);
      }
    });
  },

  switchPage: function (e) {
    const index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index) || index === this.data.currentPageIndex) return;
    const page = this.data.pages[index];
    if (!page) return;
    this.setData({
      currentPageIndex: index,
      imagePath: page.tempFilePath || '',
      fileID: page.fileID || this.data.fileID,
      currentOverlays: overlaysForPage(this.data.questions, index)
    });
  },

  toggleQuestionOverlay: function (e) {
    const id = e.currentTarget.dataset.id;
    const questions = this.data.questions.map((q) => (
      q.id === id ? { ...q, selected: !q.selected } : q
    ));
    this.setData({
      questions,
      selectedCount: questions.filter((q) => q.selected).length,
      currentOverlays: overlaysForPage(questions, this.data.currentPageIndex)
    });
  },

  onQuestionChange: function (e) {
    const selectedIds = e.detail.value || [];
    const questions = this.data.questions.map((q) => ({
      ...q,
      selected: selectedIds.indexOf(q.id) !== -1
    }));
    this.setData({
      questions,
      selectedCount: selectedIds.length,
      currentOverlays: overlaysForPage(questions, this.data.currentPageIndex)
    });
  },

  selectCategory: function (e) {
    this.setData({
      selectedCategory: e.currentTarget.dataset.name,
      selectedCategoryId: e.currentTarget.dataset.id || ''
    });
  },

  selectDifficulty: function (e) {
    this.setData({ selectedDifficulty: e.currentTarget.dataset.value });
  },

  openCategoryPicker: function () {
    this.setData({
      showPickerModal: true,
      tempCategory: this.data.selectedCategory,
      tempCategoryId: this.data.selectedCategoryId,
      tempDifficulty: this.data.selectedDifficulty,
      tempPeriod: this.data.selectedPeriod
    });
  },

  closePickerModal: function () {
    this.setData({ showPickerModal: false });
  },

  onTempCategorySelect: function (e) {
    this.setData({
      tempCategory: e.currentTarget.dataset.name,
      tempCategoryId: e.currentTarget.dataset.id || ''
    });
  },

  onTempDifficultySelect: function (e) {
    this.setData({ tempDifficulty: e.currentTarget.dataset.value });
  },

  onTempPeriodSelect: function (e) {
    this.setData({ tempPeriod: e.currentTarget.dataset.value });
  },

  confirmPickerModal: function () {
    this.setData({
      selectedCategory: this.data.tempCategory,
      selectedCategoryId: this.data.tempCategoryId,
      selectedDifficulty: this.data.tempDifficulty,
      selectedPeriod: this.data.tempPeriod,
      showPickerModal: false
    });
  },

  callQuestion: function (action, payload, timeoutMs) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'question',
        config: { timeout: timeoutMs || 60000 },
        data: { action, ...payload },
        success: (res) => resolve(res.result || {}),
        fail: reject
      });
    });
  },

  saveSelected: function () {
    const selectedQuestions = this.data.questions.filter((q) => q.selected);
    if (!selectedQuestions.length) {
      wx.showToast({ title: '请至少选择一道题', icon: 'none' });
      return;
    }

    if (!this.data.selectedCategory) {
      wx.showToast({ title: '请选择已有分类', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '正在保存...', mask: true });

    const draft = app.globalData.recognitionDraft || {};
    const payload = {
      questions: selectedQuestions.map((q) => ({
        text: q.text,
        type: q.type,
        subject: q.subject,
        confidence: q.confidence,
        imageUrl: q.imageUrl || this.data.fileID,
        pageFileIDs: q.pageFileIDs || [],
        pageSpans: q.pageSpans || []
      })),
      category: this.data.selectedCategory,
      categoryId: this.data.selectedCategoryId,
      difficulty: this.data.selectedDifficulty,
      period: this.data.selectedPeriod,
      imageUrl: this.data.fileID
    };
    const savePromise = (draft.mode === 'parent_child' && draft.studentId)
      ? wx.cloud.callFunction({
          name: 'parent',
          config: { timeout: 60000 },
          data: Object.assign({ action: 'saveChildQuestions', studentId: draft.studentId }, payload)
        }).then((res) => res.result || {})
      : this.callQuestion('batchSave', payload, 20000);

    savePromise.then((saveRes) => {
      if (!saveRes.success) {
        throw new Error(saveRes.error || '保存失败');
      }

      const saved = saveRes.data.questions || [];
      if (!saved.length) {
        throw new Error('没有成功保存的题目');
      }

      return saveRes;
    }).then((saveRes) => {
      wx.hideLoading();
      this.setData({ saving: false });
      app.globalData.recognitionDraft = null;
      const count = saveRes.data.savedCount || selectedQuestions.length;
      const parentMode = draft.mode === 'parent_child';
      wx.showToast({ title: parentMode ? `已帮孩子保存${count}道，正在解析` : `已保存${count}道，AI解析中`, icon: 'none', duration: 2000 });
      setTimeout(() => {
        if (parentMode) wx.reLaunch({ url: '/pages/parentMistakes/parentMistakes?analyzing=1' });
        else wx.switchTab({ url: '/pages/categories/categories' });
      }, 800);
    }).catch((err) => {
      wx.hideLoading();
      this.setData({ saving: false });
      wx.showModal({
        title: '保存失败',
        content: (err && err.message) || (err && err.errMsg) || '请稍后重试',
        showCancel: false
      });
    });
  }
});
