const { callTeacher } = require('../../utils/teacher');

const SUGGESTIONS = [
  '这班高频错题是哪些？',
  '哪个学科最薄弱？',
  '建议组一套针对性练习',
  '哪些学生错题比较多？'
];

function greetingFor(cls, stats) {
  if (!cls || !cls.id) {
    return '你好老师。先去「班级」建班，把加入码发给学生，他们录入错题后，我就能帮你看高频题和组卷建议。';
  }
  const name = cls.name || '当前班级';
  const total = (stats && stats.total) || 0;
  const hot = ((stats && stats.hot) || [])[0];
  if (!total) {
    return `你好老师，现在看的是「${name}」。班里还没有可统计的错题。等学生录入后，再问我高频题或组卷建议。`;
  }
  const hotHint = hot
    ? `目前最高频的是「${String(hot.content || '').slice(0, 24)}」（${hot.count} 次 / ${hot.studentCount} 人）。`
    : '';
  return `你好老师，现在看的是「${name}」，共 ${total} 道班级错题。${hotHint}问我高频错题、薄弱学科，或让我帮你决定组哪些练习。`;
}

Page({
  data: {
    classes: [],
    selectedClass: {},
    messages: [],
    suggestions: SUGGESTIONS,
    inputValue: '',
    sending: false,
    scrollTop: 0,
    nextId: 1
  },

  onLoad() { this.boot(); },

  pinToEnd() {
    this.setData({ scrollTop: 0 }, () => {
      setTimeout(() => this.setData({ scrollTop: 99999 }), 50);
    });
  },

  async boot() {
    const dash = await callTeacher('dashboard');
    const classes = (dash.success && dash.data && dash.data.classes) || [];
    const selectedClass = classes[0] || {};
    this.setData({ classes, selectedClass });
    if (this.data.sending || this.data.messages.some((m) => m.role === 'user')) return;
    await this.resetThread();
  },

  async resetThread() {
    const cls = this.data.selectedClass || {};
    let stats = { total: 0, hot: [] };
    if (cls.id) {
      const st = await callTeacher('classStats', { classId: cls.id });
      if (st.success) stats = st.data || stats;
    }
    if (this.data.sending || this.data.messages.some((m) => m.role === 'user')) return;
    this.setData({
      messages: [{ id: 0, role: 'assistant', content: greetingFor(cls, stats) }],
      nextId: 1,
      sending: false
    });
    this.pinToEnd();
  },

  selectClass(e) {
    const item = this.data.classes.find((c) => c.id === e.currentTarget.dataset.id);
    if (!item || item.id === this.data.selectedClass.id) return;
    this.setData({ selectedClass: item });
    this.resetThread();
  },

  onInput(e) { this.setData({ inputValue: e.detail.value }); },

  useSuggestion(e) {
    const text = e.currentTarget.dataset.text;
    if (!text || this.data.sending) return;
    this.setData({ inputValue: text }, () => this.send());
  },

  async send() {
    const text = (this.data.inputValue || '').trim();
    if (!text || this.data.sending) return;
    const id = this.data.nextId;
    const typingId = id + 1;
    const messages = this.data.messages.concat([
      { id, role: 'user', content: text },
      { id: typingId, role: 'assistant', content: '', typing: true }
    ]);
    this.setData({
      messages,
      inputValue: '',
      sending: true,
      nextId: typingId + 1
    }, () => this.pinToEnd());
    try {
      const payload = messages
        .filter((m) => !m.typing && (m.role === 'user' || m.role === 'assistant'))
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await callTeacher('chat', { classId: this.data.selectedClass.id, messages: payload }, 60000);
      if (!res.success) throw new Error(res.error || '回复失败');
      const next = this.data.messages.map((m) => (
        m.id === typingId ? { id: typingId, role: 'assistant', content: res.data.reply } : m
      ));
      this.setData({ messages: next }, () => this.pinToEnd());
    } catch (e) {
      const next = this.data.messages.map((m) => (
        m.id === typingId ? { id: typingId, role: 'assistant', content: e.message || '发送失败，请稍后再问一次。' } : m
      ));
      this.setData({ messages: next }, () => this.pinToEnd());
    } finally {
      this.setData({ sending: false });
    }
  }
});
