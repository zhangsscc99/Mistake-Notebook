const app = getApp();
const { formatLatex } = require('../../utils/latex');

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
      // 进入小问：先冲掉题干或上一个小问
      flushStem();
      flushSub();
      curLabel = m[1];
      subBuffer = m[2];
    } else if (curLabel) {
      // 小问内的续行
      if (line) subBuffer += '\n' + line;
    } else if (!line) {
      // 题干内空行 = 段落分隔
      flushStem();
    } else {
      stemBuffer += (stemBuffer ? '\n' : '') + line;
    }
  });
  flushStem();
  flushSub();
  return paras;
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
    inputBottom: 0
  },

  onLoad() {
    const ctxRaw = (app.globalData && app.globalData.aiChatContext) || '';
    const ctxDisplay = formatLatex(ctxRaw);
    const preview = ctxDisplay.length > 50 ? ctxDisplay.slice(0, 50) + '…' : ctxDisplay;

    const greeting = ctxRaw
      ? '你好，我是你的 AI 答疑老师。关于这道题，有什么不懂的地方都可以问我～'
      : '你好，我是你的 AI 答疑老师。把你的疑问发给我吧～';

    this.setData({
      questionContext: ctxDisplay,
      questionContextRaw: ctxRaw,
      questionParas: parseQuestionParas(ctxDisplay),
      questionPreview: preview,
      messages: [
        { id: 'm0', role: 'assistant', content: greeting, display: greeting }
      ]
    });
    this.scrollToBottom();
  },

  onUnload() {
    if (app.globalData) app.globalData.aiChatContext = '';
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

    const apiMessages = this.data.messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
      .map((m) => ({ role: m.role, content: m.content }));
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
        const reply = (result.success && result.data && result.data.reply)
          ? result.data.reply
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
  }
});
