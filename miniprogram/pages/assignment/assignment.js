Page({
  data:{assignment:{},questions:[],answers:[]},
  onLoad(o){this.id=o.id;wx.cloud.callFunction({name:'teacher',data:{action:'myAssignmentDetail',assignmentId:this.id},success:r=>{const b=r.result||{};if(!b.success)return wx.showToast({title:b.error||'加载失败',icon:'none'});const q=b.data.questions||[];this.setData({assignment:b.data,questions:q,answers:q.map(()=> '')})},fail:()=>wx.showToast({title:'加载失败',icon:'none'})})},
  onAnswer(e){const a=this.data.answers.slice();a[e.currentTarget.dataset.index]=e.detail.value;this.setData({answers:a})},
  submit(){wx.cloud.callFunction({name:'teacher',data:{action:'submitAssignment',assignmentId:this.id,answers:this.data.answers},success:r=>{const b=r.result||{};wx.showToast({title:b.success?'已提交':'提交失败',icon:b.success?'success':'none'});if(b.success)setTimeout(()=>wx.navigateBack(),700)},fail:()=>wx.showToast({title:'提交失败',icon:'none'})})}
});
