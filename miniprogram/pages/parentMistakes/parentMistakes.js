const { callParent, selectedChildId, setSelectedChildId } = require('../../utils/parent');
const { formatDay, shortText, weekDateRange } = require('../../utils/teacher');
const { kickAnswerWorker } = require('../../utils/aiPendingWatch');

function decorateQuestion(q, index) {
  const status = String(q.aiStatus || '').toLowerCase();
  const failed = status === 'failed';
  const pending = status === 'pending' || status === 'processing' || (!status && !q.ready && !q.aiAnswer);
  const processing = status === 'processing';
  let statusLabel = '已解析';
  if (failed) statusLabel = '解析失败';
  else if (processing) statusLabel = 'AI解析中';
  else if (pending) statusLabel = '等待解析';
  return {
    ...q,
    index: index + 1,
    day: formatDay(q.createdAt),
    preview: shortText(q.content, 72),
    pending,
    failed,
    ready: !failed && !pending,
    statusLabel,
    answerText: (q.aiAnswer || '').trim() || (pending ? 'AI 正在生成答案…' : '暂无答案'),
    analysisText: (q.aiAnalysis || '').trim() || (pending ? 'AI 正在生成解析…' : '暂无解析')
  };
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
    pendingCount: 0,
    byCategory: [],
    questions: [],
    hasMore: false,
    showDetail: false,
    detail: {}
  },

  onLoad(options) {
    const range = weekDateRange();
    this.setData({ fromDate: range.from, toDate: range.to, today: range.today });
    this._watchAnalyzing = options && options.analyzing === '1';
  },

  onShow() {
    if (this._watchAnalyzing) kickAnswerWorker({ action: 'processPending' });
    this.load(false);
  },
  onHide() { this.stopPoll(); },
  onUnload() { this.stopPoll(); },
  onPullDownRefresh() {
    this.load(false).finally(() => wx.stopPullDownRefresh());
  },

  onFromDate(e) {
    let fromDate = e.detail.value;
    let toDate = this.data.toDate;
    if (fromDate > toDate) toDate = fromDate;
    this.setData({ fromDate, toDate, questions: [], hasMore: false, total: 0, byCategory: [], pendingCount: 0 });
    this.loadMistakes(false);
  },

  onToDate(e) {
    let toDate = e.detail.value;
    let fromDate = this.data.fromDate;
    if (fromDate > toDate) fromDate = toDate;
    this.setData({ fromDate, toDate, questions: [], hasMore: false, total: 0, byCategory: [], pendingCount: 0 });
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
      else this.setData({ questions: [], total: 0, byCategory: [], hasMore: false, pendingCount: 0 });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadMistakes(append, quiet) {
    const studentId = this.data.childId;
    if (!studentId) return;
    if (append && (this.data.loadingMore || !this.data.hasMore)) return;
    if (!quiet) this.setData(append ? { loadingMore: true } : { loading: true });
    try {
      const r = await callParent('childMistakes', {
        studentId,
        from: this.data.fromDate,
        to: this.data.toDate,
        skip: append ? this.data.questions.length : 0
      });
      if (!r.success) throw new Error(r.error || '错题加载失败');
      const d = r.data || {};
      const start = append ? this.data.questions.length : 0;
      const incoming = (d.questions || []).map((q, i) => decorateQuestion(q, start + i));
      const patch = {
        questions: append ? this.data.questions.concat(incoming) : incoming,
        hasMore: !!d.hasMore
      };
      if (!append) {
        patch.total = d.total || incoming.length;
        patch.byCategory = d.byCategory || [];
        patch.pendingCount = typeof d.pendingCount === 'number'
          ? d.pendingCount
          : incoming.filter((q) => q.pending || q.failed).length;
      }
      this.setData(patch);
      this.syncDetail();
      this.syncPoll(patch.pendingCount != null ? patch.pendingCount : this.data.pendingCount);
    } catch (e) {
      if (!quiet) wx.showToast({ title: e.message || '错题加载失败', icon: 'none' });
    } finally {
      if (!quiet) this.setData({ loading: false, loadingMore: false });
    }
  },

  syncDetail() {
    if (!this.data.showDetail || !this.data.detail.id) return;
    const fresh = this.data.questions.find((q) => q.id === this.data.detail.id);
    if (fresh) this.setData({ detail: fresh });
  },

  syncPoll(pendingCount) {
    const n = Number(pendingCount) || 0;
    if (n > 0) this.startPoll();
    else this.stopPoll();
  },

  startPoll() {
    if (this._pollTimer) return;
    kickAnswerWorker({ action: 'processPending' });
    this._pollTicks = 0;
    this._pollTimer = setInterval(() => {
      this._pollTicks += 1;
      if (this._pollTicks > 40) {
        this.stopPoll();
        return;
      }
      this.loadMistakes(false, true);
    }, 3000);
  },

  stopPoll() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  selectChild(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || id === this.data.childId) return;
    setSelectedChildId(id);
    this.setData({ childId: id, questions: [], hasMore: false, total: 0, byCategory: [], pendingCount: 0 });
    this.loadMistakes(false);
  },

  loadMore() {
    this.loadMistakes(true);
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    const detail = this.data.questions.find((q) => q.id === id);
    if (!detail) return;
    this.setData({ showDetail: true, detail });
  },

  closeDetail() {
    this.setData({ showDetail: false });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url || (this.data.detail && this.data.detail.imageUrl);
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  },

  async retryDetail() {
    const id = this.data.detail && this.data.detail.id;
    if (!id || !this.data.childId) return;
    wx.showLoading({ title: '重新排队…', mask: true });
    try {
      const r = await callParent('retryChildQuestion', { studentId: this.data.childId, id });
      wx.hideLoading();
      if (!r.success) throw new Error(r.error || '重试失败');
      wx.showToast({ title: '已重新排队', icon: 'none' });
      this.loadMistakes(false);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '重试失败', icon: 'none' });
    }
  }
});
