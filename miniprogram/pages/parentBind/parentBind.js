const { callParent, setSelectedChildId } = require('../../utils/parent');

Page({
  data: {
    code: '',
    submitting: false
  },

  onCode(e) {
    this.setData({ code: String(e.detail.value || '').trim().toUpperCase() });
  },

  async submit() {
    if (this.data.submitting) return;
    const code = this.data.code.trim().toUpperCase();
    if (!code) return wx.showToast({ title: '请输入家长绑定码', icon: 'none' });
    this.setData({ submitting: true });
    try {
      const r = await callParent('bindChild', { parentCode: code });
      if (!r.success) throw new Error(r.error || '绑定失败');
      const d = r.data || {};
      if (d.studentId) setSelectedChildId(d.studentId);
      wx.showToast({ title: d.alreadyBound ? '已绑定过' : '绑定成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (e) {
      wx.showModal({
        title: '绑定失败',
        content: e.message || '绑定失败',
        showCancel: false
      });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
