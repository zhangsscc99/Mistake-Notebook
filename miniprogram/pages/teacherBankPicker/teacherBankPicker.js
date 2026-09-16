const app = getApp();
const { callTeacher } = require('../../utils/teacher');

const CATEGORIES = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治'];
const DIFFICULTIES = ['简单', '中等', '困难'];

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

function pickCategory(hint) {
  const want = String(hint || '').replace(/\s+/g, '');
  if (!want) return CATEGORIES[0];
  const exact = CATEGORIES.find((n) => n === want);
  if (exact) return exact;
  const fuzzy = CATEGORIES.find((n) => want.indexOf(n) !== -1 || n.indexOf(want) !== -1);
  return fuzzy || CATEGORIES[0];
}

Page({
  data: {
    classId: '',
    imagePath: '',
    fileID: '',
    pages: [],
    pageCount: 0,
    currentPageIndex: 0,
    currentOverlays: [],
    questions: [],
    categories: CATEGORIES,
    selectedCategory: '数学',
    selectedDifficulty: '中等',
    difficulties: DIFFICULTIES,
    selectedCount: 0,
    saving: false,
    showPickerModal: false,
    tempCategory: '数学',
    tempDifficulty: '中等'
  },

  onLoad() {
    const draft = app.globalData.recognitionDraft;
    if (!draft || draft.mode !== 'teacher_bank' || !draft.segments || !draft.segments.length || !draft.classId) {
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
        confidence: segment.confidence || 0,
        bounds: (pageSpans[0] && pageSpans[0].bounds) || segment.bounds || null,
        pageSpans,
        pageIndexes,
        isCrossPage,
        crossPageLabel: isCrossPage ? ('跨' + pageIndexes.length + '页') : '',
        imageUrl: fileIDs[firstPage] || draft.fileID || '',
        pageFileIDs: pageIndexes.map((i) => fileIDs[i]).filter(Boolean),
        selected: true
      };
    }).filter((q) => q.text);

    const selectedCategory = pickCategory((questions[0] && questions[0].subject) || '');
    this.setData({
      classId: draft.classId,
      imagePath: (pages[0] && pages[0].tempFilePath) || draft.tempFilePath || '',
      fileID: (pages[0] && pages[0].fileID) || draft.fileID || '',
      pages,
      pageCount: pages.length,
      currentPageIndex: 0,
      currentOverlays: overlaysForPage(questions, 0),
      questions,
      selectedCount: questions.length,
      selectedCategory,
      tempCategory: selectedCategory
    });
  },

  switchPage(e) {
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

  toggleQuestionOverlay(e) {
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

  onQuestionChange(e) {
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

  openCategoryPicker() {
    this.setData({
      showPickerModal: true,
      tempCategory: this.data.selectedCategory,
      tempDifficulty: this.data.selectedDifficulty
    });
  },
  closePickerModal() { this.setData({ showPickerModal: false }); },
  onTempCategorySelect(e) { this.setData({ tempCategory: e.currentTarget.dataset.name }); },
  onTempDifficultySelect(e) { this.setData({ tempDifficulty: e.currentTarget.dataset.value }); },
  confirmPickerModal() {
    this.setData({
      selectedCategory: this.data.tempCategory,
      selectedDifficulty: this.data.tempDifficulty,
      showPickerModal: false
    });
  },

  async saveSelected() {
    const selectedQuestions = this.data.questions.filter((q) => q.selected);
    if (!selectedQuestions.length) {
      wx.showToast({ title: '请至少选择一道题', icon: 'none' });
      return;
    }
    if (!this.data.classId) {
      wx.showToast({ title: '缺少班级', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    wx.showLoading({ title: '正在保存...', mask: true });
    try {
      const r = await callTeacher('saveBankQuestions', {
        classId: this.data.classId,
        category: this.data.selectedCategory,
        difficulty: this.data.selectedDifficulty,
        imageUrl: this.data.fileID,
        questions: selectedQuestions.map((q) => ({
          text: q.text,
          type: q.type,
          subject: q.subject,
          confidence: q.confidence,
          imageUrl: q.imageUrl || this.data.fileID,
          pageFileIDs: q.pageFileIDs || [],
          pageSpans: q.pageSpans || []
        }))
      }, 60000);
      if (!r.success) throw new Error(r.error || '保存失败');
      app.globalData.recognitionDraft = null;
      wx.hideLoading();
      this.setData({ saving: false });
      const classId = this.data.classId;
      wx.showModal({
        title: '已存入题库',
        content: '题目已进入这个班的题库，不会自动带进组卷。需要组卷时再到错题页勾选。',
        confirmText: '去选题',
        cancelText: '完成',
        success: (res) => {
          const bankUrl = '/pages/teacherQuestions/teacherQuestions?bank=1&classId=' + classId;
          if (res.confirm) {
            wx.reLaunch({ url: bankUrl + '&pick=1' });
          } else {
            wx.reLaunch({ url: bankUrl });
          }
        }
      });
    } catch (err) {
      wx.hideLoading();
      this.setData({ saving: false });
      wx.showModal({
        title: '保存失败',
        content: (err && err.message) || '请稍后重试',
        showCancel: false
      });
    }
  }
});
