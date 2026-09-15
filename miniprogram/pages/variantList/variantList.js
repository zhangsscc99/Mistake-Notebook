// pages/variantList/variantList.js
// 已保存变式题列表：生成页只出题，勾选「加入错题本」后才会出现在这里。
const DIFFICULTY_TEXT = { easy: '简单', medium: '中等', hard: '困难' };

function formatTime(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 16).replace('T', ' ');
}

Page({
  data: {
    loading: true,
    list: []
  },

  onShow() {
    this.fetchList();
  },

  onPullDownRefresh() {
    this.fetchList();
  },

  fetchList() {
    this.setData({ loading: true });
    wx.cloud.callFunction({
      name: 'question',
      config: { timeout: 15000 },
      data: { action: 'list', tag: '变式题' },
      success: (res) => {
        const result = res.result || {};
        const records = result.success && Array.isArray(result.data) ? result.data : [];
        const list = records.map((item, i) => {
          const difficulty = String(item.difficulty || 'medium').toLowerCase();
          return {
            ...item,
            index: i + 1,
            showAnswer: false,
            difficultyText: DIFFICULTY_TEXT[difficulty] || '中等',
            difficultyClass: difficulty,
            createdAtText: formatTime(item.createdAt)
          };
        });
        this.setData({ list, loading: false });
      },
      fail: () => this.setData({ list: [], loading: false }),
      complete: () => wx.stopPullDownRefresh()
    });
  },

  toggleAnswer(e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.list.map((item) => (
      String(item.id) === String(id) ? { ...item, showAnswer: !item.showAnswer } : item
    ));
    this.setData({ list });
  },

  goCategory(e) {
    const { categoryid, category } = e.currentTarget.dataset;
    if (!categoryid && !category) {
      wx.showToast({ title: '找不到原分类', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/categoryDetail/categoryDetail?id=${encodeURIComponent(categoryid || '')}&name=${encodeURIComponent(category || '分类详情')}`
    });
  },

  deleteVariant(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除变式题',
      content: '删除后不可恢复，确定删除这道变式题吗？',
      confirmText: '删除',
      confirmColor: '#e11d48',
      success: (res) => {
        if (!res.confirm) return;
        wx.cloud.callFunction({
          name: 'question',
          data: { action: 'delete', id },
          success: (r) => {
            const result = r.result || {};
            if (result.success) {
              this.setData({ list: this.data.list.filter((item) => String(item.id) !== String(id)) });
              wx.showToast({ title: '已删除', icon: 'success' });
            } else {
              wx.showToast({ title: result.error || '删除失败', icon: 'none' });
            }
          },
          fail: () => wx.showToast({ title: '网络异常，请重试', icon: 'none' })
        });
      }
    });
  },

  goCategories() {
    wx.switchTab({ url: '/pages/categories/categories' });
  }
});
