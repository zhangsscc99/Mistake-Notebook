const { callParent } = require('../../utils/parent');
const { formatDay, shortText, defaultDateRange } = require('../../utils/teacher');

function vsClassText(mineAvg, classAvg) {
  if (mineAvg == null || classAvg == null) return '';
  const d = mineAvg - classAvg;
  if (d > 0) return '高于班级均分 ' + d + ' 分';
  if (d < 0) return '低于班级均分 ' + (-d) + ' 分';
  return '与班级均分持平';
}

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
    title: '',
    meta: '',
    vsClassText: '',
    childQuestionCount: 0,
    submitted: 0,
    graded: 0,
    averageText: '—',
    childCategories: [],
    classMeta: '',
    classAverageText: '—',
    classCategories: [],
    fromDate: '',
    toDate: '',
    today: '',
    questions: [],
    hasMore: false
  },

  onLoad(options) {
    this.reportId = (options && options.id) || '';
    this.studentId = (options && options.studentId) || '';
    const range = defaultDateRange();
    this.setData({ fromDate: range.from, toDate: range.to, today: range.today });
    this.load();
  },

  onFromDate(e) {
    let fromDate = e.detail.value;
    let toDate = this.data.toDate;
    if (fromDate > toDate) toDate = fromDate;
    this.setData({ fromDate, toDate, questions: [], hasMore: false });
    this.loadMistakes(false);
  },

  onToDate(e) {
    let toDate = e.detail.value;
    let fromDate = this.data.fromDate;
    if (fromDate > toDate) fromDate = toDate;
    this.setData({ fromDate, toDate, questions: [], hasMore: false });
    this.loadMistakes(false);
  },

  async load() {
    if (!this.reportId || !this.studentId) {
      this.setData({ loading: false, title: '未找到' });
      return;
    }
    this.setData({ loading: true });
    try {
      const r = await callParent('childReportDetail', {
        id: this.reportId,
        studentId: this.studentId
      });
      if (!r.success) throw new Error(r.error || '加载失败');
      const d = r.data || {};
      const stu = d.student || {};
      this.setData({
        title: d.title || '学习情况报告',
        meta: (d.className || '') + ' · ' + (formatDay(d.createdAt) || ''),
        vsClassText: vsClassText(stu.averageScore, d.classAverage),
        childQuestionCount: stu.questionCount || 0,
        submitted: stu.submitted || 0,
        graded: stu.graded || 0,
        averageText: stu.averageScore == null ? '—' : String(stu.averageScore),
        childCategories: stu.categories || [],
        classMeta: '全班 ' + (d.studentCount || 0) + ' 人 · 错题 ' + (d.questionTotal || 0) + ' · 作业 ' + (d.assignmentCount || 0),
        classAverageText: d.classAverage == null ? '—' : (d.classAverage + '分'),
        classCategories: d.byCategory || []
      });
      await this.loadMistakes(false);
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  async loadMistakes(append) {
    if (append && (this.data.loadingMore || !this.data.hasMore)) return;
    this.setData(append ? { loadingMore: true } : { loading: true });
    try {
      const r = await callParent('childMistakes', {
        studentId: this.studentId,
        from: this.data.fromDate,
        to: this.data.toDate,
        skip: append ? this.data.questions.length : 0
      });
      if (!r.success) throw new Error(r.error || '错题加载失败');
      const d = r.data || {};
      const incoming = mapQuestions(d.questions, append ? this.data.questions.length : 0);
      this.setData({
        questions: append ? this.data.questions.concat(incoming) : incoming,
        hasMore: !!d.hasMore
      });
    } catch (e) {
      wx.showToast({ title: e.message || '错题加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false, loadingMore: false });
    }
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
