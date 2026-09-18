const { callParent, selectedChildId, setSelectedChildId } = require('../../utils/parent');

const SUGGESTIONS = [
  '孩子最近错题多在哪些学科？',
  '知识薄弱点是什么？',
  '今晚适合复习哪一类题？',
  '作业完成得怎么样？'
];

function greetingFor(child, stats) {
  if (!child || !child.studentId) {
    return '您好。先绑定孩子，我就能根据错题和作业，帮您看学习情况和薄弱点。';
  }
  const name = child.nickName || '孩子';
  const total = (stats && stats.total) || 0;
  const top = ((stats && stats.byCategory) || [])[0];
  if (!total) {
    return `您好，现在看的是「${name}」。还没有可统计的错题。您可以去「拍照」帮孩子录入试卷，再来问我学情。`;
  }
  const weak = top ? `目前错题最多的是「${top.name}」（${top.count} 道）。` : '';
  return `您好，现在看的是「${name}」，错题本里有 ${total} 道题。${weak}可以问我薄弱学科、最近错在哪，或怎么帮孩子复习。`;
}

Page({
  data: {
    children: [],
    selectedChild: {},
    messages: [],
    suggestions: SUGGESTIONS,
    inputValue: '',
    sending: false,
    scrollTop: 0,
    nextId: 1
  },

  onShow() { this.boot(); },

  pinToEnd() {
    this.setData({ scrollTop: 0 }, () => {
      setTimeout(() => this.setData({ scrollTop: 99999 }), 50);
    });
  },

  async boot() {
    const r = await callParent('myChildren');
    const children = (r.success && r.data) || [];
    let childId = selectedChildId();
    if (childId && !children.some((c) => c.studentId === childId)) childId = '';
    if (!childId && children[0]) childId = children[0].studentId;
    setSelectedChildId(childId);
    const selectedChild = children.find((c) => c.studentId === childId) || {};
    const preserve = this.data.sending || this.data.messages.some((m) => m.role === 'user');
    this.setData({ children, selectedChild });
    if (preserve) return;
    await this.resetThread();
  },

  async resetThread() {
    const child = this.data.selectedChild || {};
    let stats = { total: 0, byCategory: [] };
    if (child.studentId) {
      const st = await callParent('childMistakes', { studentId: child.studentId, skip: 0 });
      if (st.success) stats = st.data || stats;
    }
    if (this.data.sending || this.data.messages.some((m) => m.role === 'user')) return;
    this.setData({
      messages: [{ id: 0, role: 'assistant', content: greetingFor(child, stats) }],
      nextId: 1,
      sending: false
    });
    this.pinToEnd();
  },

  selectChild(e) {
    const item = this.data.children.find((c) => c.studentId === e.currentTarget.dataset.id);
    if (!item || item.studentId === this.data.selectedChild.studentId) return;
    setSelectedChildId(item.studentId);
    this.setData({ selectedChild: item });
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
    if (!this.data.selectedChild.studentId) {
      return wx.showToast({ title: '请先绑定孩子', icon: 'none' });
    }
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
      const res = await callParent('childChat', {
        studentId: this.data.selectedChild.studentId,
        messages: payload
      }, 60000);
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
