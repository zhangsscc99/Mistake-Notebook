// pages/leaderboard/leaderboard.js
function readScore(row, metric) {
  if (metric === 'questions') {
    return Number(row.score != null ? row.score : row.questionCount) || 0;
  }
  return Number(row.score != null ? row.score : row.checkinStreak) || 0;
}

function withScoreText(row, metric) {
  const score = readScore(row || {}, metric);
  return {
    ...(row || {}),
    score,
    scoreText: metric === 'questions' ? score + ' 道' : score + ' 天'
  };
}

Page({
  data: {
    rows: [],
    me: null,
    metric: 'checkin',
    loading: true,
    error: ''
  },

  onLoad: function () {
    this.load();
  },

  onShow: function () {
    if (!this._loadedOnce) {
      this._loadedOnce = true;
      return;
    }
    this.load({ silent: true });
  },

  callCloud: function (data) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'user',
        data,
        config: { timeout: 20000 },
        success: (res) => resolve(res.result || {}),
        fail: reject
      });
    });
  },

  load: function (opts) {
    const silent = !!(opts && opts.silent);
    const metric = this.data.metric;
    if (!silent) this.setData({ loading: true, error: '' });
    return this.callCloud({ action: 'leaderboard', metric })
      .then((res) => {
        if (!res.success) throw new Error(res.error || '读取失败');
        const d = res.data || {};
        this.setData({
          rows: (d.rows || []).map((row) => withScoreText(row, metric)),
          me: d.me ? withScoreText(d.me, metric) : null,
          loading: false
        });
      })
      .catch((err) => {
        console.error('[leaderboard] 读取失败', err);
        this.setData({ loading: false, error: silent ? this.data.error : '排行榜加载失败' });
      });
  },

  onPullDownRefresh: function () {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  setMetric: function (e) {
    const metric = e.currentTarget.dataset.value || 'checkin';
    if (metric === this.data.metric) return;
    this.setData({ metric });
    this.load();
  },

  goEmptyAction: function () {
    if (this.data.metric === 'questions') {
      wx.switchTab({ url: '/pages/index/index' });
      return;
    }
    wx.switchTab({ url: '/pages/profile/profile' });
  }
});
