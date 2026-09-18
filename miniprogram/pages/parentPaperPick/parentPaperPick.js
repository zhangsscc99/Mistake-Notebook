const { callParent, selectedChildId, setSelectedChildId } = require('../../utils/parent');
const { promptPaperTitle } = require('../../utils/paper.js');

function preview(content) {
  const plain = String(content || '').replace(/\s+/g, ' ').trim();
  return plain.length > 72 ? plain.slice(0, 72) + '...' : plain;
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    children: [],
    childId: '',
    childName: '',
    questions: [],
    visibleQuestions: [],
    category: '',
    categoryChips: [{ name: '全部', value: '', count: 0 }],
    selectedMap: {},
    selectedCount: 0,
    visibleAllSelected: false,
    hasMore: false,
    skip: 0,
    pendingCount: 0,
    readyCount: 0
  },

  onLoad() { this.boot(); },

  async boot() {
    this.setData({ loading: true });
    try {
      const r = await callParent('myChildren');
      const children = (r.success && r.data) || [];
      let childId = selectedChildId();
      if (childId && !children.some((c) => c.studentId === childId)) childId = '';
      if (!childId && children[0]) childId = children[0].studentId;
      setSelectedChildId(childId);
      const current = children.find((c) => c.studentId === childId) || {};
      this.setData({ children, childId, childName: current.nickName || '' });
      if (childId) await this.loadQuestions(childId, true);
      else this.syncView({ questions: [], skip: 0, hasMore: false, pendingCount: 0 });
    } finally {
      this.setData({ loading: false });
    }
  },

  syncView(patch) {
    const next = Object.assign({}, this.data, patch || {});
    const pool = (next.questions || []).filter((q) => q.ready);
    const category = next.category || '';
    const visibleQuestions = category
      ? pool.filter((q) => (q.category || '未分类') === category)
      : pool;
    const catMap = {};
    pool.forEach((q) => {
      const name = q.category || '未分类';
      catMap[name] = (catMap[name] || 0) + 1;
    });
    const categoryChips = [{ name: '全部', value: '', count: pool.length }].concat(
      Object.keys(catMap).map((name) => ({ name, value: name, count: catMap[name] }))
    );
    const visibleAllSelected = visibleQuestions.length > 0
      && visibleQuestions.every((q) => next.selectedMap[q.id]);
    this.setData(Object.assign({}, patch, {
      visibleQuestions,
      readyCount: pool.length,
      categoryChips,
      visibleAllSelected
    }));
  },

  async loadQuestions(studentId, reset) {
    const skip = reset ? 0 : this.data.skip;
    const r = await callParent('childMistakes', { studentId, skip });
    const data = (r.success && r.data) || {};
    const incoming = (data.questions || []).map((q) => ({
      ...q,
      id: String(q.id),
      preview: preview(q.content)
    }));
    const questions = reset ? incoming : this.data.questions.concat(incoming);
    const pendingCount = questions.filter((q) => !q.ready).length;
    this.syncView({
      questions,
      skip: skip + incoming.length,
      hasMore: !!data.hasMore,
      pendingCount
    });
  },

  selectChild(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || id === this.data.childId) return;
    setSelectedChildId(id);
    const current = this.data.children.find((c) => c.studentId === id) || {};
    this.setData({
      childId: id,
      childName: current.nickName || '',
      category: '',
      selectedMap: {},
      selectedCount: 0
    });
    this.setData({ loading: true });
    this.loadQuestions(id, true).finally(() => this.setData({ loading: false }));
  },

  selectCategory(e) {
    this.syncView({ category: e.currentTarget.dataset.value || '' });
  },

  selectAllVisible() {
    const map = Object.assign({}, this.data.selectedMap);
    this.data.visibleQuestions.forEach((q) => { map[q.id] = true; });
    this.syncView({ selectedMap: map, selectedCount: Object.keys(map).length });
  },

  clearVisible() {
    const map = Object.assign({}, this.data.selectedMap);
    this.data.visibleQuestions.forEach((q) => { delete map[q.id]; });
    this.syncView({ selectedMap: map, selectedCount: Object.keys(map).length });
  },

  toggleQuestion(e) {
    const id = e.currentTarget.dataset.id;
    const map = Object.assign({}, this.data.selectedMap);
    if (map[id]) delete map[id];
    else map[id] = true;
    this.syncView({ selectedMap: map, selectedCount: Object.keys(map).length });
  },

  async loadMore() {
    if (this.data.loadingMore || !this.data.hasMore || !this.data.childId) return;
    this.setData({ loadingMore: true });
    try {
      await this.loadQuestions(this.data.childId, false);
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  cancel() {
    wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/parentPaper/parentPaper' }) });
  },

  confirm() {
    const ids = Object.keys(this.data.selectedMap);
    if (!ids.length) return wx.showToast({ title: '请先选题', icon: 'none' });
    const picked = this.data.questions.filter((q) => this.data.selectedMap[q.id] && q.ready);
    if (!picked.length) return wx.showToast({ title: '未解析完成的题目不能加入组卷', icon: 'none' });
    const defaultTitle = (this.data.childName || '孩子') + '练习卷';
    promptPaperTitle(defaultTitle)
      .then((title) => {
        wx.showLoading({ title: '保存中...', mask: true });
        return callParent('saveChildPaper', {
          studentId: this.data.childId,
          paper: {
            title,
            questions: picked.map((q) => ({ id: q.id }))
          }
        }, 20000);
      })
      .then((r) => {
        wx.hideLoading();
        if (!r.success) return wx.showToast({ title: r.error || '保存失败', icon: 'none' });
        wx.navigateBack({
          success: () => wx.showToast({ title: '试卷已保存到孩子账号', icon: 'success' }),
          fail: () => wx.reLaunch({
            url: '/pages/parentPaper/parentPaper',
            success: () => wx.showToast({ title: '试卷已保存到孩子账号', icon: 'success' })
          })
        });
      })
      .catch((err) => {
        wx.hideLoading();
        if (err && (err.message === 'cancelled' || err.message === 'empty_title')) return;
        wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' });
      });
  }
});
