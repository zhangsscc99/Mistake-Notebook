function callTeacher(action, data, timeout) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'teacher',
      data: Object.assign({ action: action }, data || {}),
      config: { timeout: timeout || 30000 },
      success: (res) => resolve(res.result || {}),
      fail: reject
    });
  });
}

function shortText(text, n) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '未识别题目';
  return s.length > (n || 48) ? s.slice(0, n || 48) + '…' : s;
}

function formatDay(iso) {
  if (!iso) return '';
  const s = String(iso);
  return s.indexOf('T') > 0 ? s.split('T')[0] : s.slice(0, 10);
}

function isPastDue(dueAt) {
  const s = String(dueAt || '').trim();
  if (!s) return false;
  const day = formatDay(s);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const t = Date.parse(s);
    return Number.isFinite(t) && Date.now() > t;
  }
  const end = Date.parse(day + 'T23:59:59+08:00');
  return Number.isFinite(end) && Date.now() > end;
}

function ymdOf(d) {
  const x = d instanceof Date ? d : new Date();
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: ymdOf(from), to: ymdOf(to), today: ymdOf(to) };
}

function weekDateRange() {
  const to = new Date();
  const from = new Date();
  const day = from.getDay();
  const diff = day === 0 ? 6 : day - 1;
  from.setDate(from.getDate() - diff);
  return { from: ymdOf(from), to: ymdOf(to), today: ymdOf(to) };
}

function decorateReport(raw) {
  const r = raw || {};
  const students = (r.students || []).map((s) => ({
    ...s,
    scoreText: s.averageScore == null ? '待批改' : (s.averageScore + '分'),
    weakText: s.weak ? ('薄弱：' + s.weak) : '暂无错题分类'
  }));
  const catTotal = (r.byCategory || []).reduce((n, c) => n + (c.count || 0), 0);
  const byCategory = (r.byCategory || []).map((c) => ({
    ...c,
    pct: c.pct || (catTotal ? Math.round((c.count * 100) / catTotal) : 0)
  }));
  const fromText = formatDay(r.from) || '';
  const toText = formatDay(r.to) || '';
  const rangeText = fromText && toText ? (fromText + ' 至 ' + toText) : '';
  return {
    id: r.id || r._id || '',
    title: r.title || '学习情况报告',
    classId: r.classId || '',
    className: r.className || '',
    createdText: formatDay(r.createdAt) || '',
    rangeText,
    studentCount: r.studentCount || students.length,
    questionTotal: r.questionTotal || 0,
    assignmentCount: r.assignmentCount || 0,
    classAverageText: r.classAverage == null ? '—' : (r.classAverage + '分'),
    byCategory,
    students
  };
}

function buildCopyText(report) {
  const lines = [
    `【${report.title}】`,
    report.rangeText ? ('统计区间 ' + report.rangeText) : report.createdText,
    `学生 ${report.studentCount} 人 · 错题 ${report.questionTotal} 道 · 作业 ${report.assignmentCount} 份 · 班级均分 ${report.classAverageText}`,
    ''
  ];
  if (report.byCategory.length) {
    lines.push('学科分布：' + report.byCategory.map((c) => `${c.name} ${c.count}`).join('、'));
    lines.push('');
  }
  lines.push('学生情况：');
  if (!report.students.length) lines.push('暂无学生');
  report.students.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.nickName}  错题${s.questionCount}道  作业已交${s.submitted}  均分${s.scoreText}  ${s.weakText}`);
  });
  lines.push('');
  lines.push('——来自智卷错题通教师工作台');
  return lines.join('\n');
}

module.exports = {
  callTeacher,
  shortText,
  formatDay,
  isPastDue,
  ymdOf,
  defaultDateRange,
  weekDateRange,
  decorateReport,
  buildCopyText
};
