// pages/variantList/variantList.js
// 已保存变式题列表：生成页只出题，勾选「加入错题本」后才会出现在这里。
const app = getApp();
const { savePaperToCloud, promptPaperTitle, partitionPaperQuestions } = require('../../utils/paper.js');

const DIFFICULTY_TEXT = { easy: '简单', medium: '中等', hard: '困难' };

function formatTime(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 16).replace('T', ' ');
}

function mapForPaper(q) {
  return {
    id: q.id,
    content: q.content,
    answer: q.aiAnswer || '待补充',
    analysis: q.aiAnalysis || 'AI暂未给出解析',
    aiStatus: q.aiStatus || '',
    aiAnswer: q.aiAnswer || '',
    aiAnalysis: q.aiAnalysis || '',
    categoryId: q.categoryId,
    categoryName: q.category || q.categoryName,
    tags: q.tags || [],
    difficulty: q.difficultyText || q.difficulty
  };
}

Page({
  data: {
    loading: true,
    list: [],
    editMode: false,
    selectedCount: 0
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
            selected: false,
            difficultyText: DIFFICULTY_TEXT[difficulty] || '中等',
            difficultyClass: difficulty,
            createdAtText: formatTime(item.createdAt)
          };
        });
        this.setData({ list, loading: false, editMode: false, selectedCount: 0 });
      },
      fail: () => this.setData({ list: [], loading: false, editMode: false, selectedCount: 0 }),
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

  onCardTap(e) {
    if (!this.data.editMode) return;
    const id = e.currentTarget.dataset.id;
    const list = this.data.list.map((item) => (
      String(item.id) === String(id) ? { ...item, selected: !item.selected } : item
    ));
    this.setData({
      list,
      selectedCount: list.filter((item) => item.selected).length
    });
  },

  startBatchExam() {
    if (!this.data.editMode) {
      this.setData({ editMode: true, selectedCount: 0 });
      wx.showToast({ title: '勾选题目后点确认组卷', icon: 'none' });
      return;
    }
    const selected = this.data.list.filter((item) => item.selected);
    if (!selected.length) {
      wx.showToast({ title: '请先选择题目', icon: 'none' });
      return;
    }
    this.commitExam(selected);
  },

  cancelEdit() {
    const list = this.data.list.map((item) => ({ ...item, selected: false }));
    this.setData({ list, editMode: false, selectedCount: 0 });
  },

  addOneToExam(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find((q) => String(q.id) === String(id));
    if (!item) {
      wx.showToast({ title: '题目信息缺失', icon: 'none' });
      return;
    }
    this.commitExam([item]);
  },

  commitExam(items) {
    const { ready, blocked } = partitionPaperQuestions(items);
    if (!ready.length) {
      wx.showToast({ title: '未解析完成的题目不能加入组卷', icon: 'none' });
      return;
    }
    if (blocked.length) {
      wx.showToast({ title: `已跳过${blocked.length}道未解析题`, icon: 'none' });
    }
    const mapped = ready.map(mapForPaper);
    const existing = app.globalData.selectedPaperQuestions || [];
    const merged = [...existing];
    mapped.forEach((q) => {
      if (!merged.some((item) => String(item.id) === String(q.id))) {
        merged.push(q);
      }
    });

    promptPaperTitle('变式练习卷')
      .then((title) => {
        wx.showLoading({ title: '保存中...', mask: true });
        return savePaperToCloud(merged, title);
      })
      .then((result) => {
        wx.hideLoading();
        app.globalData.selectedPaperQuestions = [];
        const list = this.data.list.map((item) => ({ ...item, selected: false }));
        this.setData({ list, editMode: false, selectedCount: 0 });
        wx.switchTab({
          url: '/pages/paperBuilder/paperBuilder',
          success: () => {
            wx.showToast({
              title: result.localOnly ? '已本地保存' : '试卷保存成功',
              icon: 'success'
            });
          }
        });
      })
      .catch((err) => {
        wx.hideLoading();
        if (err && (err.message === 'cancelled' || err.message === 'empty_title')) return;
        if (err && err.message === 'not_ready') {
          wx.showToast({ title: '未解析完成的题目不能加入组卷', icon: 'none' });
          return;
        }
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
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
              const list = this.data.list.filter((item) => String(item.id) !== String(id));
              this.setData({
                list,
                selectedCount: list.filter((item) => item.selected).length
              });
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
