const app = getApp();
const { formatLatex } = require('../../utils/latex');
const { getProfile, getCachedProfile } = require('../../utils/profile');
const { inviteCard, timelineCard, enableShareMenu } = require('../../utils/share');
const { dismissLoginOverlay } = require('../../utils/auth');

// 把题目文本拆成结构化段落：题干段（逐段独立）+ 各小问块
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
      if (line) subBuffer += '\n' + line;
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

// 昵称是可选的：拿不到就退回原来的「你好」，六条文案都要能自然读通。
// 注意下面的 `hi` 后面统一跟一个「，」，所以带昵称时读作「你好，小明，你上次问过…」
function buildGreeting(ctxRaw, memoryStatus, nickName) {
  const name = (nickName || '').trim();
  const hi = name ? `你好，${name}` : '你好';

  if (memoryStatus && memoryStatus.hasMemory) {
    const questions = memoryStatus.lastQuestions;
    if (questions && questions.length > 0) {
      const lastQ = questions[questions.length - 1];
      if (ctxRaw) {
        return `${hi}，你上次问过「${lastQ}」，关于这道题，有什么不懂的地方都可以问我～`;
      }
      return `${hi}，你上次问过「${lastQ}」，今天继续学吧～`;
    }
    if (memoryStatus.topics && memoryStatus.topics.length > 0) {
      const topicHint = memoryStatus.topics.slice(0, 4).join('、');
      if (ctxRaw) {
        return `${hi}，我记得你之前学过 ${topicHint} 等内容。关于这道题，有什么不懂的地方都可以问我～`;
      }
      return `${hi}，我记得你之前学过 ${topicHint} 等内容，继续把疑问发给我吧～`;
    }
  }
  if (ctxRaw) {
    return `${hi}，我是你的 AI 答疑老师。关于这道题，有什么不懂的地方都可以问我～`;
  }
  return `${hi}，我是你的 AI 答疑老师。把你的疑问发给我吧～`;
}

Page({
  data: {
    questionContext: '',
    questionContextRaw: '',
    questionParas: [],
    questionPreview: '',
    contextVisible: false,
    messages: [],
    inputValue: '',
    sending: false,
    scrollToId: '',
    inputBottom: 0,
    // 头像放在页面级，不塞进 messages 的每一项 ——
    // messages 在好几处被手工重建（:135/:159/:234/:237/:267），
    // 逐条挂字段迟早漏掉某处；页面级读一次，本轮所有用户气泡都对
    avatarFileID: '',
    nickName: '',
    // 今日免费额度。remaining 为 -1 表示会员、不限量（与云函数约定一致）
    quotaRemaining: -1,
    quotaLimit: 0,
    isVip: false
  },

  onLoad() {
    this._sessionSaved = false;
    this._activeContext = null;
  },

  // 本页现在是 tabBar 页：switchTab 不会重跑 onLoad，上下文只能在这里读
  onShow() {
    dismissLoginOverlay();
    enableShareMenu();
    // 必须先于下面所有提前 return —— 否则切回本 tab 时头像昵称不会刷新
    this.loadProfile();

    // 消费掉外部塞进来的题目上下文，否则每次切回 tab 都会被重复触发
    const ctxRaw = (app.globalData && app.globalData.aiChatContext) || '';
    if (ctxRaw) app.globalData.aiChatContext = '';

    // 普通切 tab（无新上下文）时保留当前会话，只有从错题进来才重开会话
    if (!ctxRaw && this._activeContext !== null) return;
    if (ctxRaw === this._activeContext) return;

    this.startConversation(ctxRaw);
  },

  // 同步铺缓存 + 异步刷新。同步那步很关键：下面的 startConversation 是紧接着同步调用的，
  // 只能读到此刻 this.data.nickName 的值。
  loadProfile() {
    const apply = (p) => this.setData({
      avatarFileID: p.avatarFileID || '',
      nickName: p.nickName || ''
    });

    apply(getCachedProfile());
    getProfile()
      .then(apply)
      .catch((err) => {
        console.warn('[aiChat] 读取资料失败，沿用缓存', err);
      });
  },

  startConversation(ctxRaw) {
    this._activeContext = ctxRaw;
    this._sessionSaved = false;

    const ctxDisplay = formatLatex(ctxRaw);
    const preview = ctxDisplay.length > 50 ? ctxDisplay.slice(0, 50) + '…' : ctxDisplay;
    // 读 this.data.nickName 而不是再挂一个异步写入者去改 messages[0]：
    // 那条消息已经被 loadMemoryGreeting 写过一次，三方竞争会互相覆盖
    const greeting = buildGreeting(ctxRaw, null, this.data.nickName);

    this.setData({
      questionContext: ctxDisplay,
      questionContextRaw: ctxRaw,
      questionParas: parseQuestionParas(ctxDisplay),
      questionPreview: preview,
      contextVisible: false,
      scrollToId: '',
      messages: [
        { id: 'm' + Date.now(), role: 'assistant', content: greeting, display: greeting }
      ]
    });
    this.setTitle(ctxRaw);
    this.scrollToBottom();
    this.loadMemoryGreeting(ctxRaw);
  },

  // 通用问答 vs 针对某道错题的讲解，用标题区分
  setTitle(ctxRaw) {
    wx.setNavigationBarTitle({ title: ctxRaw ? '错题讲解' : '对话助手' });
  },

  loadMemoryGreeting(ctxRaw) {
    wx.cloud.callFunction({
      name: 'answer',
      config: { timeout: 15000 },
      data: { action: 'getMemoryStatus' },
      success: (res) => {
        const result = res.result || {};
        const data = result.data;

        // 额度先处理，且必须放在 hasMemory 的提前 return **之前** ——
        // 刚上手、还没有任何对话记忆的用户恰恰最需要看到剩余条数
        this.applyQuota(data && data.quota);

        if (!result.success || !data || !data.hasMemory) return;
        // 这里再读一次 nickName：onShow 里那次异步刷新多半已经落地，
        // 拿到的比 startConversation 时更准
        const greeting = buildGreeting(ctxRaw, data, this.data.nickName);
        const messages = [...this.data.messages];
        if (messages.length > 0 && messages[0].role === 'assistant') {
          messages[0] = { ...messages[0], content: greeting, display: greeting };
          this.setData({ messages });
        }
      }
    });
  },

  // quota 是云函数 answer 的统一形状：{ isVip, limit, used, remaining }，
  // remaining 为 -1 表示会员不限量
  applyQuota(quota) {
    if (!quota) return;
    this.setData({
      isVip: !!quota.isVip,
      quotaLimit: quota.limit || 0,
      quotaRemaining: typeof quota.remaining === 'number' ? quota.remaining : -1
    });
  },

  getApiMessages() {
    return this.data.messages
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
      .map((m) => ({ role: m.role, content: m.content }));
  },

  persistSessionMemory() {
    if (this._sessionSaved) return;

    const messages = this.getApiMessages();
    const userCount = messages.filter((m) => m.role === 'user').length;
    if (userCount === 0) return;

    this._sessionSaved = true;

    wx.cloud.callFunction({
      name: 'answer',
      config: { timeout: 60000 },
      data: {
        action: 'summarize',
        messages,
        questionContext: this.data.questionContextRaw
      }
    });
  },

  onHide() {
    this.persistSessionMemory();
  },

  onUnload() {
    this.persistSessionMemory();
  },

  showContext() {
    this.setData({ contextVisible: true });
  },

  hideContext() {
    this.setData({ contextVisible: false });
  },

  noop() {},

  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  onFocus(e) {
    this.setData({ inputBottom: (e.detail.height || 0) });
  },

  onBlur() {
    this.setData({ inputBottom: 0 });
  },

  scrollToBottom() {
    const list = this.data.messages;
    if (list.length === 0) return;
    this.setData({ scrollToId: 'msg-' + list[list.length - 1].id });
  },

  sendMessage() {
    const text = (this.data.inputValue || '').trim();
    if (!text || this.data.sending) return;

    const messages = [...this.data.messages];
    const userId = 'u' + Date.now();
    messages.push({ id: userId, role: 'user', content: text, display: formatLatex(text) });

    const typingId = 't' + Date.now();
    messages.push({ id: typingId, role: 'assistant', content: '', display: '', typing: true });

    this.setData({ messages, inputValue: '', sending: true });
    this.scrollToBottom();

    const apiMessages = this.getApiMessages();
    apiMessages.push({ role: 'user', content: text });

    wx.cloud.callFunction({
      name: 'answer',
      config: { timeout: 60000 },
      data: {
        action: 'chat',
        messages: apiMessages,
        questionContext: this.data.questionContextRaw
      },
      success: (res) => {
        const result = res.result || {};
        const data = result.data || {};

        // 额度用尽必须单独判，否则会掉进下面那句「出了点问题」——
        // 用户看到的就成了一次莫名其妙的技术故障，而不是「该去兑换会员了」
        if (!result.success && result.error === 'QUOTA_EXCEEDED') {
          this.applyQuota({ isVip: false, limit: data.limit, remaining: 0 });
          this.replaceTyping(typingId,
            data.message || '今日免费对话已用完，可在「我的」用金币兑换会员');
          return;
        }

        if (result.success) this.applyQuota(data.quota);

        const reply = (result.success && data.reply)
          ? data.reply
          : '抱歉，我这边出了点问题，请稍后再试。';
        this.replaceTyping(typingId, reply);
      },
      fail: () => {
        this.replaceTyping(typingId, '网络好像不太顺畅，请稍后再问我一次。');
      }
    });
  },

  replaceTyping(typingId, reply) {
    const messages = this.data.messages.map((m) => (
      m.id === typingId
        ? { id: m.id, role: 'assistant', content: reply, display: formatLatex(reply) }
        : m
    ));
    this.setData({ messages, sending: false });
    this.scrollToBottom();
  },

  onShareAppMessage() {
    return inviteCard();
  },

  onShareTimeline() {
    return timelineCard();
  }
});
