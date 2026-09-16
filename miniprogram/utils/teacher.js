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

module.exports = {
  callTeacher,
  shortText,
  formatDay,
  isPastDue
};
