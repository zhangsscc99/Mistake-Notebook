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

// 截止日期当天（北京时间）23:59:59 仍可交，过了才拦截。未设截止则不限。
function isPastDue(dueAt) {
  const day = formatDay(dueAt);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return Date.now() > new Date(day + 'T23:59:59.999+08:00').getTime();
}

module.exports = {
  callTeacher,
  shortText,
  formatDay,
  isPastDue
};
