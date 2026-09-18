const app = getApp();
const { clearSession, goLogin } = require('../../utils/auth');
const { getCachedProfile, getProfile } = require('../../utils/profile');
const { performDeleteAccount, finishDeleteAccount } = require('../../utils/account');
const { callParent, setSelectedChildId } = require('../../utils/parent');

Page({
  data: {
    nickName: '',
    children: [],
    deleting: false
  },

  onShow() {
    const p = getCachedProfile();
    this.setData({ nickName: p.nickName || '' });
    getProfile().then((x) => this.setData({ nickName: x.nickName || '' })).catch(() => {});
    this.loadChildren();
  },

  async loadChildren() {
    const r = await callParent('myChildren');
    if (r.success) this.setData({ children: r.data || [] });
  },

  goBind() {
    wx.navigateTo({ url: '/pages/parentBind/parentBind' });
  },

  unbind(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '这个孩子';
    if (!id) return;
    wx.showModal({
      title: '解除绑定',
      content: '解除后将看不到' + name + '的作业和报告。',
      confirmText: '解除',
      confirmColor: '#e11d48',
      success: async (res) => {
        if (!res.confirm) return;
        const r = await callParent('unbindChild', { studentId: id });
        wx.showToast({ title: r.success ? '已解除' : (r.error || '失败'), icon: r.success ? 'success' : 'none' });
        if (r.success) {
          setSelectedChildId('');
          this.loadChildren();
        }
      }
    });
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后不会删除绑定关系，身份也不会改变。下次登录仍进入家长端。',
      confirmText: '退出',
      success: (res) => {
        if (!res.confirm) return;
        clearSession();
        app.globalData.parentChildId = '';
        goLogin({ force: true });
      }
    });
  },

  onDeleteAccount() {
    if (this.data.deleting) return;
    wx.showModal({
      title: '注销账号',
      content: '将永久删除本账号下的：\n· 个人资料与家长身份\n· 与孩子的绑定关系\n\n不会删除孩子的错题和作业。删除后无法恢复。',
      confirmText: '继续',
      confirmColor: '#e11d48',
      success: (res) => {
        if (res.confirm) this.confirmDeleteAccount();
      }
    });
  },

  confirmDeleteAccount() {
    wx.showModal({
      title: '最后确认',
      content: '再次确认删除全部家长数据？\n\n微信账号不受影响。注销后同一微信可以重新选择身份。',
      confirmText: '确认删除',
      confirmColor: '#e11d48',
      success: (res) => {
        if (res.confirm) this.doDeleteAccount();
      }
    });
  },

  async doDeleteAccount() {
    if (this.data.deleting) return;
    this.setData({ deleting: true });
    try {
      const r = await performDeleteAccount();
      finishDeleteAccount(r);
    } catch (e) {
      wx.showToast({ title: e.message || '注销失败', icon: 'none' });
      this.setData({ deleting: false });
    }
  }
});
