const { callParent } = require('../../utils/parent');
const { formatDay } = require('../../utils/teacher');

function vsClassText(mineAvg, classAvg) {
  if (mineAvg == null || classAvg == null) return '';
  const d = mineAvg - classAvg;
  if (d > 0) return '高于班级均分 ' + d + ' 分';
  if (d < 0) return '低于班级均分 ' + (-d) + ' 分';
  return '与班级均分持平';
}

Page({
  data: {
    loading: true,
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
    classCategories: []
  },

  onLoad(options) {
    this.reportId = (options && options.id) || '';
    this.studentId = (options && options.studentId) || '';
    this.load();
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
      const fromText = formatDay(d.from);
      const toText = formatDay(d.to);
      const rangeText = fromText && toText ? (fromText + ' 至 ' + toText) : '';
      this.setData({
        title: d.title || '学习情况报告',
        meta: (d.className || '') + (rangeText ? (' · ' + rangeText) : (' · ' + (formatDay(d.createdAt) || ''))),
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
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
