const { callParent, selectedChildId, setSelectedChildId } = require('../../utils/parent');
const { formatDay, shortText, weekDateRange } = require('../../utils/teacher');

function mapQuestions(list, start) {
  return (list || []).map((q, i) => ({
    ...q,
    index: start + i + 1,
    day: formatDay(q.createdAt),
    preview: shortText(q.content, 48)
  }));
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    children: [],
    childId: '',
    fromDate: '',
    toDate: '',
    today: '',
    total: 0,
    byCategory: [],
    questions: [],
    hasMore: false
  },

  onLoad() {
    const range = weekDateRange();
    this.setData({ fromDate: range.from, toDate: range.to, today: range.today });
  },

  onShow() {
    this.load(false);
  },
  onPullDownRefresh() {
    this.load(false).finally(() => wx.stopPullDownRefresh());
  },

  onFromDate(e) {
    let fromDate = e.detail.value;
    let toDate = this.data.toDate;
    if (fromDate > toDate) toDate = fromDate;
    this.setData({ fromDate, toDate, questions: [], hasMore: false, total: 0, byCategory: [] });
    this.loadMistakes(false);
  },

  onToDate(e) {
    let toDate = e.detail.value;
    let fromDate = this.data.fromDate;
    if (fromDate > toDate) fromDate = toDate;
    this.setData({ fromDate, toDate, questions: [], hasMore: false, total: 0, byCategory: [] });
    this.loadMistakes(false);
  },

  async load() {
    this.setData({ loading: true });
    try {
      const r = await callParent('myChildren');
      if (!r.success) throw new Error(r.error || '加载失败');
      const children = r.data || [];
      let childId = selectedChildId();
      if (childId && !children.some((c) => c.studentId === childId)) childId = '';
      if (!childId && children[0]) childId = children[0].studentId;
      setSelectedChildId(childId);
      this.setData({ children, childId });
      if (childId) await this.loadMistakes(false);
      else this.setData({ questions: [], total: 0, byCategory: [], hasMore: false });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadMistakes(append) {
    const studentId = this.data.childId;
    if (!studentId) return;
    if (append && (this.data.loadingMore || !this.data.hasMore)) return;
    this.setData(append ? { loadingMore: true } : { loading: true });
    try {
      const r = await callParent('childMistakes', {
        studentId,
        from: this.data.fromDate,
        to: this.data.toDate,
        skip: append ? this.data.questions.length : 0
      });
      if (!r.success) throw new Error(r.error || '错题加载失败');
      const d = r.data || {};
      const incoming = mapQuestions(d.questions, append ? this.data.questions.length : 0);
      const patch = {
        questions: append ? this.data.questions.concat(incoming) : incoming,
        hasMore: !!d.hasMore
      };
      if (!append) {
        patch.total = d.total || incoming.length;
        patch.byCategory = d.byCategory || [];
      }
      this.setData(patch);
    } catch (e) {
      wx.showToast({ title: e.message || '错题加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false, loadingMore: false });
    }
  },

  selectChild(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || id === this.data.childId) return;
    setSelectedChildId(id);
    this.setData({ childId: id, questions: [], hasMore: false, total: 0, byCategory: [] });
    this.loadMistakes(false);
  },

  loadMore() {
    this.loadMistakes(true);
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  }
});
