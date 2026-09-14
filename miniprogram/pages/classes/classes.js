Page({
  data: { classes: [], messages: [], loading: true },
  onLoad() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  call(action) { return new Promise((resolve, reject) => wx.cloud.callFunction({ name:'teacher', data:{action}, success:r=>resolve(r.result||{}), fail:reject })); },
  async load() { this.setData({loading:true}); try { const [c,m] = await Promise.all([this.call('myClasses'),this.call('myMessages')]); this.setData({classes:c.success?c.data||[]:[],messages:m.success?m.data||[]:[]}); } catch(e) { wx.showToast({title:'加载失败',icon:'none'}); } finally { this.setData({loading:false}); } }
});
