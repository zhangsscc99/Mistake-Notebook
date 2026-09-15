// pages/categoryDetail/categoryDetail.js
const app = getApp();
const { savePaperToCloud, promptPaperTitle } = require('../../utils/paper.js');
const { formatLatex } = require('../../utils/latex');

const SYMBOL_MAP = {
  '数学': '数', '物理': '物', '化学': '化', '英语': '英',
  '语文': '语', '生物': '生', '历史': '史', '地理': '地'
};

// 标记成功后的提示语，下标 0 = 取消、1 = 设置
const MARK_LABELS = {
  favorite: ['已取消收藏', '已收藏'],
  pinned: ['已取消置顶', '已置顶']
};

function parseQuestionParas(text) {
  if (!text) return [];
  const normalized = String(text).replace(/\r\n/g, '\n').trim();
  const lines = normalized.split('\n');
  const paras = [];
  let stemBuffer = '';
  let curLabel = '';
  let subBuffer = '';

  const flushStem = () => {
    const content = stemBuffer.trim();
    if (content) paras.push({ label: '', text: content, sub: false });
    stemBuffer = '';
  };

  const flushSub = () => {
    const content = subBuffer.trim();
    if (curLabel && content) paras.push({ label: curLabel, text: content, sub: true });
    curLabel = '';
    subBuffer = '';
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    const m = line.match(/^[（(]\s*(\d+)\s*[)）]\s*(.*)$/);
    if (m) {
      flushStem();
      flushSub();
      curLabel = m[1];
      subBuffer = m[2];
    } else if (curLabel) {
      if (line) subBuffer += (subBuffer ? '\n' : '') + line;
    } else if (!line) {
      flushStem();
    } else {
      stemBuffer += (stemBuffer ? '\n' : '') + line;
    }
  });
  flushStem();
  flushSub();
  return paras;
}

function formatQuestionText(raw) {
  return formatLatex(raw || '');
}

function buildAiDisplayText(value, pending, emptyFallback, pendingFallback) {
  const raw = (value || '').trim();
  if (raw) return formatQuestionText(raw);
  if (pending) return pendingFallback;
  return emptyFallback;
}

function buildDetailQuestion(item, index) {
  const pending = item.aiStatus === 'pending' || item.aiStatus === 'processing';
  const hasAiAnswer = !!(item.aiAnswer && String(item.aiAnswer).trim());
  const hasAiAnalysis = !!(item.aiAnalysis && String(item.aiAnalysis).trim());
  const rawContent = item.content || '暂无内容';
  const formattedContent = formatQuestionText(rawContent);
  const contentParas = parseQuestionParas(formattedContent);
  return {
    id: item.id,
    displayIndex: index + 1,
    content: formattedContent,
    contentParas: contentParas.length ? contentParas : [{ label: '', text: formattedContent, sub: false }],
    imageUrl: item.imageUrl || '',
    hasAiAnswer,
    hasAiAnalysis,
    aiAnswer: buildAiDisplayText(item.aiAnswer, pending, hasAiAnalysis ? '见下方解析' : '暂无 AI 答案', 'AI 答案生成中…'),
    aiAnalysis: buildAiDisplayText(item.aiAnalysis, pending, '暂无 AI 解析', 'AI 解析生成中…'),
    aiStatus: item.aiStatus || '',
    tags: item.tags || [],
    difficultyText: item.difficultyText,
    difficultyClass: item.difficultyClass,
    formattedDate: item.formattedDate
  };
}

Page({
  data: {
    categoryId: null,
    categoryName: '',
    categoryIcon: '题',
    questions: [],
    displayQuestions: [],
    sortBy: 'latest',
    filterBy: 'all',
    tagFilter: 'all',
    availableTags: [],
    favoriteCount: 0,
    pinnedCount: 0,
    accuracy: 0,
    editMode: false,
    isPaperSelectMode: false,
    selectedCount: 0,
    isAllSelected: false,
    groupByKnowledgePoint: true,
    knowledgePointGroups: [],
    expandedGroups: {},
    showDetailModal: false,
    detailQuestion: null,
    detailNote: '',
    detailNoteUpdatedAt: '',
    noteSaving: false,
    loading: false
  },

  onLoad(options) {
    const id = options.id;
    const name = decodeURIComponent(options.name || '分类详情');
    const isPaperSelectMode = options.mode === 'paper-select';
    this.setData({
      categoryId: id,
      categoryName: name,
      categoryIcon: SYMBOL_MAP[name] || '题',
      isPaperSelectMode,
      editMode: isPaperSelectMode
    });
    wx.setNavigationBarTitle({ title: name });
    this.fetchQuestions(id, name);
  },

  onPullDownRefresh: function () {
    const id = this.data.categoryId;
    const name = this.data.categoryName;
    if (id) {
      this.fetchQuestions(id, name);
    }
    setTimeout(() => wx.stopPullDownRefresh(), 3000);
  },

  fetchQuestions(categoryId, categoryName) {
    this.setData({ loading: true });
    wx.showLoading({ title: '加载中...' });
    wx.cloud.callFunction({
      name: 'question',
      data: { action: 'byCategory', categoryId: categoryId, categoryName: categoryName },
      success: (res) => {
        if (res.result && res.result.success) {
          const list = Array.isArray(res.result.data) ? res.result.data : [];
          const processed = list.map(q => {
            const fullContent = q.content || q.recognizedText || '';
            const formatted = formatQuestionText(fullContent);
            return {
              ...q,
              content: fullContent,
              displayContent: formatted.length > 200 ? formatted.slice(0, 200) + '…' : formatted,
              difficultyClass: (q.difficulty || 'medium').toLowerCase(),
              difficultyText: q.difficulty === 'EASY' || q.difficulty === 'easy' ? '简单'
                : q.difficulty === 'HARD' || q.difficulty === 'hard' ? '困难' : '中等',
              formattedDate: q.createdAt ? String(q.createdAt).split('T')[0] : '2026-05-30',
              showAI: false,
              isCorrect: q.isCorrect || false,
              selected: false,
              // questions 是全局共享的题库，标记只存在于 question_marks 里，
              // 这里先给默认值保证界面有确定的初值，真值由 loadMarks 合并进来
              favorite: false,
              pinned: false,
              mastered: false,
              // 笔记同理，在 question_notes 里，真值由 loadNotes 合并
              hasNote: false
            };
          });
          this.setData({ questions: processed, loading: false });
          this.refreshTags();
          this.applyFilters();
          this.calcAccuracy();
          this.loadMarks();
          this.loadNotes();
        } else {
          this.setData({ questions: [] });
          this.refreshTags();
          this.applyFilters();
          this.calcAccuracy();
        }
      },
      fail: () => {
        this.setData({ questions: [] });
        this.refreshTags();
        this.applyFilters();
        this.calcAccuracy();
      },
      complete: () => {
        wx.hideLoading();
        wx.stopPullDownRefresh();
        this.setData({ loading: false });
      }
    });
  },

  useMockQuestions(categoryName) {
    let mockList;
    if (categoryName.includes('数学')) {
      mockList = [
        { id: 101, content: '已知函数 f(x) = x² - 2x + 1，当 x ∈ [0, 3] 时，求 f(x) 的最大值与最小值。', difficulty: 'medium', difficultyClass: 'medium', difficultyText: '中等', formattedDate: '2026-05-28', tags: ['二次函数', '最值'], showAI: false, isCorrect: true, selected: false, aiAnswer: '最小值是 0，最大值是 4。', aiAnalysis: 'f(x) = (x - 1)². 当 x = 1 时，取得最小值 f(1) = 0. 当 x = 3 时，距离对称轴 x = 1 最远，取得最大值 f(3) = 4.' },
        { id: 102, content: '若集合 A = {x | x² - 3x + 2 = 0}，B = {x | 1 < x < 3}，求 A ∩ B。', difficulty: 'easy', difficultyClass: 'easy', difficultyText: '简单', formattedDate: '2026-05-29', tags: ['集合', '一元二次方程'], showAI: false, isCorrect: true, selected: false, aiAnswer: 'A ∩ B = {2}', aiAnalysis: '解方程 x² - 3x + 2 = 0 得 x = 1 或 x = 2，因此 A = {1, 2}. B = {x | 1 < x < 3}. 所以 A ∩ B = {2}.' }
      ];
    } else if (categoryName.includes('物理')) {
      mockList = [
        { id: 201, content: '一质量为 2kg 的物体在水平面上受到 10N 的水平推力，物体与水平面间的动摩擦因数为 0.2。求物体的加速度。（g取10m/s²）', difficulty: 'medium', difficultyClass: 'medium', difficultyText: '中等', formattedDate: '2026-05-27', tags: ['牛顿第二定律', '摩擦力'], showAI: false, isCorrect: false, selected: false, aiAnswer: '物体的加速度 a = 3 m/s²', aiAnalysis: '滑动摩擦力 f = μN = μmg = 0.2 * 2 * 10 = 4 N. 根据牛顿第二定律得：F - f = ma. a = (F - f) / m = (10 - 4) / 2 = 3 m/s².' }
      ];
    } else {
      mockList = [
        { id: 999, content: `这是 ${categoryName} 的示例错题。`, difficulty: 'easy', difficultyClass: 'easy', difficultyText: '简单', formattedDate: '2026-05-30', tags: ['示例'], showAI: false, isCorrect: true, selected: false, aiAnswer: '答案', aiAnalysis: '解析' }
      ];
    }
    const processedMock = mockList.map(q => ({
      ...q,
      displayContent: q.content && q.content.length > 200 ? q.content.slice(0, 200) + '…' : (q.content || '')
    }));
    this.setData({ questions: processedMock });
    this.refreshTags();
    this.applyFilters();
    this.calcAccuracy();
  },

  refreshTags() {
    const tags = new Set();
    this.data.questions.forEach((q) => {
      (q.tags || []).forEach((tag) => tags.add(tag));
    });
    this.setData({ availableTags: Array.from(tags), tagFilter: 'all' });
  },

  refreshMarkCounts() {
    let favoriteCount = 0;
    let pinnedCount = 0;
    this.data.questions.forEach((q) => {
      if (q.favorite) favoriteCount += 1;
      if (q.pinned) pinnedCount += 1;
    });
    this.setData({ favoriteCount, pinnedCount });
  },

  // 标记是每人一份的（questions 本身没有归属字段），且必须等 byCategory
  // 回来拿到题目 id 才能查 —— 所以这里是第二次往返，没办法并成 Promise.all
  loadMarks() {
    const ids = this.data.questions
      .map(q => q.id)
      .filter(id => id !== undefined && id !== null && id !== '');
    if (!ids.length) return;

    wx.cloud.callFunction({
      name: 'question',
      data: { action: 'listMarks', questionIds: ids.slice(0, 200) },
      success: (res) => {
        const result = res.result || {};
        if (!result.success || !result.data) return;

        const marks = result.data;
        const busy = this._markBusy || {};
        // 有在途标记请求的题目跳过：那份快照比用户刚点的旧，
        // 盖回去会让界面和库里悄悄分家
        const questions = this.data.questions.map((q) => {
          const key = String(q.id);
          if (busy[key]) return q;
          const m = marks[key] || {};
          return {
            ...q,
            favorite: !!m.favorite,
            pinned: !!m.pinned,
            mastered: !!m.mastered
          };
        });

        // 必须重算 applyFilters：置顶改顺序、收藏改「★ 收藏」筛选的结果
        this.setData({ questions });
        this.refreshMarkCounts();
        this.applyFilters();
      },
      // 失败静默。题目本身已经显示出来了，为了几个星标把整页报成错误不划算，
      // 下拉刷新自会重试
      fail: () => {}
    });
  },

  // 拉当前用户在这些题上的笔记，给列表加「有笔记」角标。失败静默，同 loadMarks
  loadNotes() {
    const ids = this.data.questions
      .map(q => q.id)
      .filter(id => id !== undefined && id !== null && id !== '');
    if (!ids.length) return;

    wx.cloud.callFunction({
      name: 'question',
      data: { action: 'listNotes', questionIds: ids.slice(0, 200) },
      success: (res) => {
        const result = res.result || {};
        if (!result.success || !result.data) return;
        const notes = result.data;
        const questions = this.data.questions.map((q) => {
          const n = notes[String(q.id)];
          return { ...q, hasNote: !!(n && n.note) };
        });
        this.setData({ questions });
        this.applyFilters();
      },
      fail: () => {}
    });
  },

  findQuestion(id) {
    return this.data.questions.find(q => String(q.id) === String(id));
  },

  toggleFavorite(e) {
    const id = e.currentTarget.dataset.id;
    const q = this.findQuestion(id);
    if (!q) return;
    this.applyMark(id, 'favorite', !q.favorite);
  },

  togglePin(e) {
    const id = e.currentTarget.dataset.id;
    const q = this.findQuestion(id);
    if (!q) return;
    this.applyMark(id, 'pinned', !q.pinned);
  },

  // 乐观更新 + 失败回滚，写法同 profile.js 的 onStageSelect。
  // 同一个 id 上有在途请求时忽略后续点击：这个接口写的是「状态」不是「增量」，
  // 两次连点若并发落到服务端，回来的顺序不保证，最终库里的值可能和界面相反。
  // 串行化是唯一稳妥的做法（云函数侧是确定性 _id 的 set，也不会写出两条记录）
  applyMark(id, field, value) {
    const key = String(id);
    this._markBusy = this._markBusy || {};
    if (this._markBusy[key]) return;
    this._markBusy[key] = true;

    const optimistic = this.data.questions.map(q => (
      String(q.id) === key ? { ...q, [field]: value } : q
    ));
    this.setData({ questions: optimistic });
    this.refreshMarkCounts();
    this.applyFilters();

    wx.cloud.callFunction({
      name: 'question',
      data: { action: 'mark', questionId: key, [field]: value },
      success: (res) => {
        const result = res.result || {};
        if (!result.success) {
          this.rollbackMark(key, field, !value, result.error);
          return;
        }
        // 以服务端返回为准：它会把这次没传的字段一起回带
        const data = result.data || {};
        const confirmed = this.data.questions.map(q => (
          String(q.id) === key
            ? {
              ...q,
              favorite: !!data.favorite,
              pinned: !!data.pinned,
              mastered: !!data.mastered
            }
            : q
        ));
        this.setData({ questions: confirmed });
        this.refreshMarkCounts();
        this.applyFilters();
        wx.showToast({ title: MARK_LABELS[field][value ? 1 : 0], icon: 'none' });
      },
      fail: () => this.rollbackMark(key, field, !value, 'network'),
      complete: () => { delete this._markBusy[key]; }
    });
  },

  rollbackMark(id, field, value, error) {
    const questions = this.data.questions.map(q => (
      String(q.id) === id ? { ...q, [field]: value } : q
    ));
    this.setData({ questions });
    this.refreshMarkCounts();
    this.applyFilters();
    console.error('[categoryDetail] 标记失败', error || '');
    wx.showToast({ title: '操作失败，请重试', icon: 'none' });
  },

  buildKnowledgePointGroups(list) {
    const groups = new Map();
    list.forEach((q, listIndex) => {
      const points = (q.tags && q.tags.length > 0) ? q.tags : ['其他'];
      const key = points[0];
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push({
        ...q,
        _listIndex: this.data.questions.findIndex((item) => item.id === q.id),
        _displayIndex: listIndex
      });
    });
    const expandedGroups = this.data.expandedGroups;
    return Array.from(groups.entries()).map(([name, questions]) => ({
      name,
      questions,
      count: questions.length,
      expanded: expandedGroups[name] !== false
    }));
  },

  toggleGroupByKnowledgePoint() {
    this.setData({ groupByKnowledgePoint: !this.data.groupByKnowledgePoint });
    this.applyFilters();
  },

  toggleGroup(e) {
    const name = e.currentTarget.dataset.name;
    const expandedGroups = { ...this.data.expandedGroups, [name]: !this.data.expandedGroups[name] };
    const knowledgePointGroups = this.data.knowledgePointGroups.map((g) =>
      g.name === name ? { ...g, expanded: expandedGroups[name] !== false } : g
    );
    this.setData({ expandedGroups, knowledgePointGroups });
  },

  // 置顶恒在最前，其余仍按用户选的排序方式。
  // 不做「先按置顶排一遍、再按所选方式排一遍」—— 那要依赖 Array.sort 的稳定性，
  // 而且两次排序谁说了算读代码时也看不出来。做成「置顶是第一关键字、
  // 所选方式是第二关键字」的单一比较器，一次排序，与引擎实现无关
  buildComparator() {
    const sortBy = this.data.sortBy;
    const ORDER = { hard: 3, HARD: 3, medium: 2, MEDIUM: 2, easy: 1, EASY: 1 };
    const base = (a, b) => {
      if (sortBy === 'earliest') {
        return (a.formattedDate || '').localeCompare(b.formattedDate || '');
      }
      if (sortBy === 'difficulty') {
        return (ORDER[b.difficulty] || 2) - (ORDER[a.difficulty] || 2);
      }
      if (sortBy === 'confidence') {
        return (b.aiConfidence || b.confidence || 0) - (a.aiConfidence || a.confidence || 0);
      }
      return (b.formattedDate || '').localeCompare(a.formattedDate || '');
    };
    return (a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || base(a, b);
  },

  applyFilters() {
    let list = [...this.data.questions];

    // 「收藏」和难度共用 filterBy：它们是同一排 chip 里的单选。
    // 没有做成两个独立的筛选维度，是因为「收藏 + 简单」这种组合在两排高亮里
    // 读不出来，用户会以为筛选坏了。选中收藏时难度自然让位
    if (this.data.filterBy === 'favorite') {
      list = list.filter(q => !!q.favorite);
    } else if (this.data.filterBy !== 'all') {
      list = list.filter(q => (q.difficulty || '').toLowerCase() === this.data.filterBy);
    }
    if (this.data.tagFilter !== 'all') {
      list = list.filter(q => (q.tags || []).includes(this.data.tagFilter));
    }

    list.sort(this.buildComparator());

    const knowledgePointGroups = this.buildKnowledgePointGroups(list);
    this.setData({ displayQuestions: list, knowledgePointGroups });
    this.updateSelectionState();
  },

  calcAccuracy() {
    if (this.data.questions.length === 0) { this.setData({ accuracy: 0 }); return; }
    const correct = this.data.questions.filter(q => q.isCorrect).length;
    this.setData({ accuracy: Math.round((correct / this.data.questions.length) * 100) });
  },

  updateSelectionState() {
    const visibleIds = this.getVisibleQuestionIds();
    const visibleQuestions = this.data.questions.filter((q) => visibleIds.has(String(q.id)));
    const selectedCount = this.data.questions.filter((q) => q.selected).length;
    const isAllSelected = visibleQuestions.length > 0
      && visibleQuestions.every((q) => q.selected);
    this.setData({ selectedCount, isAllSelected });
  },

  getSelectedQuestions() {
    return this.data.questions.filter(q => q.selected);
  },

  setSort(e) {
    this.setData({ sortBy: e.currentTarget.dataset.sort });
    this.applyFilters();
  },

  setFilter(e) {
    this.setData({ filterBy: e.currentTarget.dataset.filter });
    this.applyFilters();
  },

  setTagFilter(e) {
    this.setData({ tagFilter: e.currentTarget.dataset.tag });
    this.applyFilters();
  },

  toggleEditMode() {
    const editMode = !this.data.editMode;
    let expandedGroups = { ...this.data.expandedGroups };
    let questions;

    if (editMode) {
      this.data.knowledgePointGroups.forEach((g) => {
        expandedGroups[g.name] = true;
      });
      questions = this.data.questions.map((q) => ({ ...q }));
    } else {
      questions = this.data.questions.map((q) => ({ ...q, selected: false }));
    }

    this.setData({ editMode, questions, expandedGroups });
    this.applyFilters();
  },

  toggleSelectAll() {
    const visibleIds = this.getVisibleQuestionIds();
    const target = !this.data.isAllSelected;
    const questions = this.data.questions.map((q) => {
      if (visibleIds.has(String(q.id))) {
        return { ...q, selected: target };
      }
      return q;
    });
    this.setData({ questions });
    this.applyFilters();
  },

  getVisibleQuestionIds() {
    const ids = new Set();
    if (this.data.groupByKnowledgePoint && this.data.knowledgePointGroups.length > 0) {
      this.data.knowledgePointGroups.forEach((group) => {
        if (group.expanded) {
          group.questions.forEach((q) => ids.add(String(q.id)));
        }
      });
    } else {
      this.data.displayQuestions.forEach((q) => ids.add(String(q.id)));
    }
    return ids;
  },

  onQuestionTap(e) {
    if (!this.data.editMode) {
      this.viewQuestion(e);
      return;
    }
    const id = String(e.currentTarget.dataset.id);
    const questions = this.data.questions.map((q) => (
      String(q.id) === id ? { ...q, selected: !q.selected } : q
    ));
    this.setData({ questions });
    this.applyFilters();
  },

  openAIChat(e) {
    const content = e.currentTarget.dataset.content || '';
    app.globalData.aiChatContext = content;
    // aiChat 现在是 tabBar 页，只能用 switchTab 跳转；题目上下文由它的 onShow 读取
    wx.switchTab({ url: '/pages/aiChat/aiChat' });
  },

  previewImage(e) {
    wx.previewImage({ urls: [e.currentTarget.dataset.url] });
  },

  onQuestionImgError(e) {
    const id = e.currentTarget.dataset.id;
    const questions = this.data.questions.map((q) => (
      String(q.id) === String(id) ? { ...q, imageUrl: '' } : q
    ));
    this.setData({ questions });
    this.applyFilters();
  },

  viewQuestion(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.displayQuestions[index];
    if (!item) return;

    this.setData({
      showDetailModal: true,
      detailQuestion: buildDetailQuestion(item, index),
      detailNote: '',
      detailNoteUpdatedAt: '',
      noteSaving: false
    });

    if (!item.id) return;

    this.loadDetailNote(item.id);

    wx.cloud.callFunction({
      name: 'question',
      data: { action: 'get', id: item.id },
      success: (res) => {
        const fresh = res.result && res.result.data;
        if (!res.result || !res.result.success || !fresh) return;

        const merged = {
          ...item,
          aiAnswer: fresh.aiAnswer || item.aiAnswer || '',
          aiAnalysis: fresh.aiAnalysis || item.aiAnalysis || '',
          aiStatus: fresh.aiStatus || item.aiStatus || '',
          content: fresh.content || item.content,
          tags: fresh.tags || item.tags
        };

        const questions = this.data.questions.map((q) => (
          String(q.id) === String(item.id) ? { ...q, ...merged } : q
        ));
        this.setData({
          questions,
          detailQuestion: buildDetailQuestion(merged, index)
        });
        this.applyFilters();
      }
    });
  },

  closeDetailModal() {
    this.setData({ showDetailModal: false, noteSaving: false });
  },

  // ─── 我的笔记（每人对每题一条，存 question_notes）─────────────────────────

  loadDetailNote(id) {
    wx.cloud.callFunction({
      name: 'question',
      data: { action: 'getNote', questionId: String(id) },
      success: (res) => {
        const result = res.result || {};
        if (!result.success || !result.data) return;
        this.setData({
          detailNote: result.data.note || '',
          detailNoteUpdatedAt: result.data.updatedAt
            ? String(result.data.updatedAt).slice(0, 16).replace('T', ' ')
            : ''
        });
      },
      fail: () => {}
    });
  },

  onDetailNoteInput(e) {
    this.setData({ detailNote: e.detail.value });
  },

  saveDetailNote() {
    const dq = this.data.detailQuestion;
    if (!dq || !dq.id || this.data.noteSaving) return;

    const note = (this.data.detailNote || '').trim();
    this.setData({ noteSaving: true });
    wx.cloud.callFunction({
      name: 'question',
      data: { action: 'saveNote', questionId: String(dq.id), note },
      success: (res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '保存失败，请重试', icon: 'none' });
          return;
        }
        const updatedAt = result.data.updatedAt
          ? String(result.data.updatedAt).slice(0, 16).replace('T', ' ')
          : '';
        // 同步列表页的「有笔记」角标
        const questions = this.data.questions.map((q) => (
          String(q.id) === String(dq.id) ? { ...q, hasNote: !!note } : q
        ));
        this.setData({ questions, detailNoteUpdatedAt: updatedAt });
        this.applyFilters();
        wx.showToast({ title: note ? '笔记已保存' : '笔记已清空', icon: 'success' });
      },
      fail: () => wx.showToast({ title: '网络异常，请重试', icon: 'none' }),
      complete: () => this.setData({ noteSaving: false })
    });
  },

  // ─── 多题 AI 功能入口（错因分析 / 变式题，至少 2 题）──────────────────────

  enterEditMode() {
    if (!this.data.editMode) this.toggleEditMode();
  },

  startMistakeReport() {
    if (this.getSelectedQuestions().length >= 2) {
      this.goMistakeReport();
      return;
    }
    this.enterEditMode();
    wx.showToast({ title: '请勾选至少 2 道错题', icon: 'none' });
  },

  startVariants() {
    if (this.getSelectedQuestions().length >= 1) {
      this.goVariants();
      return;
    }
    this.enterEditMode();
    wx.showToast({ title: '请勾选至少 1 道错题', icon: 'none' });
  },

  goMistakeReport() {
    const selected = this.getSelectedQuestions();
    if (selected.length < 2) {
      wx.showToast({ title: '错因分析至少选择 2 道题', icon: 'none' });
      return;
    }
    const ids = selected.map(q => q.id).join(',');
    wx.navigateTo({ url: `/pages/mistakeReport/mistakeReport?ids=${encodeURIComponent(ids)}` });
  },

  goVariants() {
    const selected = this.getSelectedQuestions();
    if (selected.length < 1) {
      wx.showToast({ title: '请先选择题目', icon: 'none' });
      return;
    }
    const ids = selected.map(q => q.id).join(',');
    wx.navigateTo({ url: `/pages/variants/variants?ids=${encodeURIComponent(ids)}` });
  },

  generateVariantsFromDetail() {
    const dq = this.data.detailQuestion;
    if (!dq || !dq.id) {
      wx.showToast({ title: '题目信息缺失', icon: 'none' });
      return;
    }
    this.closeDetailModal();
    wx.navigateTo({ url: `/pages/variants/variants?ids=${encodeURIComponent(String(dq.id))}` });
  },

  previewDetailImage(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ urls: [url] });
  },

  deleteQuestion(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: '确认删除',
      content: '是否确认将此错题从错题本中彻底移除？',
      success(res) {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中...' });
        wx.cloud.callFunction({
          name: 'question',
          data: { action: 'delete', id: id },
          success: () => {
            wx.hideLoading();
            that.removeQuestionById(id);
            wx.showToast({ title: '删除成功', icon: 'success' });
          },
          fail: () => {
            wx.hideLoading();
            that.removeQuestionById(id);
            wx.showToast({ title: '删除成功', icon: 'success' });
          }
        });
      }
    });
  },

  removeQuestionById(id) {
    const list = this.data.questions.filter(q => q.id !== id);
    this.setData({ questions: list });
    this.refreshMarkCounts();
    this.applyFilters();
    this.calcAccuracy();
  },

  goBackToHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  addToExam() {
    const selected = this.getSelectedQuestions();
    if (!selected.length) {
      if (!this.data.editMode) {
        this.toggleEditMode();
        wx.showToast({ title: '勾选题目后点击确认组卷', icon: 'none' });
        return;
      }
      wx.showToast({ title: '请先选择题目', icon: 'none' });
      return;
    }

    const mapped = selected.map((q) => ({
      id: q.id,
      content: q.content,
      answer: q.aiAnswer || '待补充',
      analysis: q.aiAnalysis || 'AI暂未给出解析',
      categoryId: this.data.categoryId,
      categoryName: this.data.categoryName,
      tags: q.tags || [],
      difficulty: q.difficultyText || q.difficulty
    }));

    const existing = app.globalData.selectedPaperQuestions || [];
    const merged = [...existing];
    mapped.forEach((q) => {
      if (!merged.some((item) => String(item.id) === String(q.id))) {
        merged.push(q);
      }
    });

    const defaultTitle = this.data.categoryName
      ? `${this.data.categoryName}练习卷`
      : '练习卷';

    promptPaperTitle(defaultTitle)
      .then((title) => {
        wx.showLoading({ title: '保存中...', mask: true });
        return savePaperToCloud(merged, title);
      })
      .then((result) => {
        wx.hideLoading();
        app.globalData.selectedPaperQuestions = [];
        app.globalData.categoriesMode = null;

        const questions = this.data.questions.map((q) => ({ ...q, selected: false }));
        this.setData({ questions, editMode: false });
        this.applyFilters();

        wx.switchTab({
          url: '/pages/paperBuilder/paperBuilder',
          success: () => {
            const msg = result.localOnly ? '已本地保存' : '试卷保存成功';
            wx.showToast({ title: msg, icon: 'success' });
          }
        });
      })
      .catch((err) => {
        wx.hideLoading();
        if (err && err.message === 'cancelled') return;
        if (err && err.message === 'empty_title') return;
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
  },

  batchDelete() {
    const selected = this.getSelectedQuestions();
    if (!selected.length) {
      wx.showToast({ title: '请先选择题目', icon: 'none' });
      return;
    }

    const that = this;
    wx.showModal({
      title: '确认删除',
      content: `确定要删除选中的 ${selected.length} 道题目吗？`,
      success(res) {
        if (!res.confirm) return;
        const ids = selected.map(q => q.id);
        wx.showLoading({ title: '删除中...' });
        wx.cloud.callFunction({
          name: 'question',
          data: { action: 'batchDelete', ids },
          success: () => {
            wx.hideLoading();
            that.removeQuestionsByIds(ids);
            wx.showToast({ title: '删除成功', icon: 'success' });
          },
          fail: () => {
            wx.hideLoading();
            that.removeQuestionsByIds(ids);
            wx.showToast({ title: '删除成功', icon: 'success' });
          }
        });
      }
    });
  },

  removeQuestionsByIds(ids) {
    const idSet = new Set(ids);
    const list = this.data.questions.filter(q => !idSet.has(q.id));
    this.setData({ questions: list, editMode: false });
    this.refreshMarkCounts();
    this.applyFilters();
    this.calcAccuracy();
  },

  startPractice() {
    if (this.data.questions.length === 0) {
      wx.showToast({ title: '该分类暂无题目', icon: 'none' });
      return;
    }
    wx.showToast({ title: '开始练习功能即将上线', icon: 'none' });
  }
});
