const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function openId() { const c = cloud.getWXContext(); return c.OPENID || c.FROM_OPENID || ''; }
function fail(error) { return { success: false, error }; }
async function teacherDoc(id) { const r = await db.collection('users').where({ _id: id }).limit(1).get(); return (r.data || [])[0] || null; }
async function requireTeacher() { const id = openId(); if (!id) throw new Error('NOT_TEACHER'); const user = await teacherDoc(id); if (!user || user.role !== 'teacher') throw new Error('NOT_TEACHER'); return id; }
function normalizeClass(c) { return { id: c._id, name: c.name, grade: c.grade || '', joinCode: c.joinCode, studentCount: c.studentCount || 0, createdAt: c.createdAt }; }

exports.main = async event => {
  try {
    if (event.action === 'joinClass') return joinClass(event);
    if (event.action === 'myClasses') return myClasses();
    if (event.action === 'myMessages') return myMessages();
    const teacherId = await requireTeacher();
    switch (event.action) {
      case 'dashboard': return dashboard(teacherId);
      case 'createClass': return createClass(teacherId, event);
      case 'students': return students(teacherId, event.classId);
      case 'studentQuestions': return studentQuestions(teacherId, event);
      case 'teacherQuestions': return teacherQuestions(teacherId);
      case 'publishNotebook': return publishNotebook(teacherId, event);
      case 'message': return message(teacherId, event);
      default: return fail(`Unknown action: ${event.action}`);
    }
  } catch (e) { if (e.message === 'NOT_TEACHER') return fail('NOT_TEACHER'); console.error(e); return fail(e.message || '教师工作台加载失败'); }
};

async function ownedClasses(teacherId) { const r = await db.collection('classes').where({ teacherId, isDeleted: false }).orderBy('createdAt','desc').get(); return r.data || []; }
async function students(teacherId, classId) { if (!classId) return fail('Missing classId'); const cls = (await db.collection('classes').doc(classId).get()).data; if (!cls || cls.teacherId !== teacherId) return fail('无权访问该班级'); const r = await db.collection('class_members').where({ classId, isDeleted: false }).get(); const members = r.data || []; if (!members.length) return { success:true,data:[] }; const ids = members.map(m => m.studentId); const users = await db.collection('users').where({ _id: _.in(ids) }).get(); const questions = await Promise.all(ids.map(id => db.collection('questions').where({ ownerId:id, isDeleted:false }).count().then(x=>x.total).catch(()=>0))); return { success:true,data:(users.data||[]).map((u,i)=>({ id:u._id,nickName:u.nickName||'',avatarFileID:u.avatarFileID||'',questionCount:questions[i]||0,practiceCount:0,lastActiveAt:u.updatedAt||'' })) }; }
async function dashboard(teacherId) { const raw = await ownedClasses(teacherId); const classes = await Promise.all(raw.map(async c => ({ ...normalizeClass(c), studentCount:(await db.collection('class_members').where({ classId:c._id,isDeleted:false }).count()).total }))); const selected = classes[0]; const list = selected ? await students(teacherId, selected.id) : { data:[] }; const msg = await db.collection('teacher_messages').where({ teacherId, isDeleted:false, readAt:'' }).count().catch(()=>({total:0})); return { success:true,data:{ classes, students:list.data||[], studentCount:classes.reduce((n,c)=>n+c.studentCount,0), messageCount:msg.total||0 } }; }
async function createClass(teacherId,event) { const name=String(event.name||'').trim(); if(!name) return fail('请输入班级名称'); const code=Math.random().toString(36).slice(2,8).toUpperCase(); const now=new Date().toISOString(); const r=await db.collection('classes').add({data:{teacherId,name,joinCode:code,isDeleted:false,createdAt:now,updatedAt:now}}); return {success:true,data:{id:r._id,name,joinCode:code,studentCount:0}}; }
async function message(teacherId,event) { const content=String(event.content||'').trim(); if(!event.classId||!content) return fail('留言内容不能为空'); const cls=(await db.collection('classes').doc(event.classId).get()).data; if(!cls||cls.teacherId!==teacherId)return fail('无权操作该班级'); const now=new Date().toISOString(); const r=await db.collection('teacher_messages').add({data:{teacherId,classId:event.classId,content,isDeleted:false,createdAt:now,updatedAt:now,readAt:''}}); return {success:true,data:{id:r._id,content,createdAt:now}}; }
async function joinClass(event) { const studentId=openId(); const joinCode=String(event.joinCode||'').trim().toUpperCase(); if(!studentId||!joinCode)return fail('请输入班级加入码'); const r=await db.collection('classes').where({joinCode,isDeleted:false}).limit(1).get(); const cls=(r.data||[])[0]; if(!cls)return fail('加入码无效'); const existing=await db.collection('class_members').where({classId:cls._id,studentId,isDeleted:false}).count(); if(existing.total>0)return {success:true,data:{classId:cls._id,name:cls.name,alreadyJoined:true}}; const now=new Date().toISOString(); await db.collection('class_members').add({data:{classId:cls._id,studentId,isDeleted:false,createdAt:now,updatedAt:now}}); return {success:true,data:{classId:cls._id,name:cls.name,alreadyJoined:false}}; }
async function myClasses() { const studentId=openId(); if(!studentId)return fail('未获取到用户身份'); const memberships=await db.collection('class_members').where({studentId,isDeleted:false}).get(); const classes=await Promise.all((memberships.data||[]).map(async m=>{const r=await db.collection('classes').doc(m.classId).get(); const c=r.data; if(!c||c.isDeleted)return null; const t=await teacherDoc(c.teacherId); return {id:c._id,name:c.name,grade:c.grade||'',teacherName:(t&&t.nickName)||'教师',joinedAt:m.createdAt||''};})); return {success:true,data:classes.filter(Boolean)}; }
async function myMessages() { const studentId=openId(); if(!studentId)return fail('未获取到用户身份'); const memberships=await db.collection('class_members').where({studentId,isDeleted:false}).get(); const ids=(memberships.data||[]).map(m=>m.classId); if(!ids.length)return {success:true,data:[]}; const r=await db.collection('teacher_messages').where({classId:_.in(ids),isDeleted:false}).orderBy('createdAt','desc').limit(50).get(); return {success:true,data:r.data||[]}; }
async function studentQuestions(teacherId,event) { const studentId=String(event.studentId||''); const classId=String(event.classId||''); if(!studentId||!classId)return fail('参数不完整'); const cls=(await db.collection('classes').doc(classId).get()).data; if(!cls||cls.teacherId!==teacherId)return fail('无权访问该班级'); const member=(await db.collection('class_members').where({classId,studentId,isDeleted:false}).count()).total; if(!member)return fail('学生不在该班级'); const r=await db.collection('questions').where({ownerId:studentId,isDeleted:false}).orderBy('createdAt','desc').limit(50).get(); return {success:true,data:(r.data||[]).map(q=>({id:q._id,content:q.content||'',category:q.category||'',difficulty:q.difficulty||'MEDIUM',aiStatus:q.aiStatus||'',createdAt:q.createdAt||''}))}; }
async function teacherQuestions(teacherId) { const r=await db.collection('questions').where({ownerId:teacherId,isDeleted:false}).orderBy('createdAt','desc').limit(100).get(); return {success:true,data:(r.data||[]).map(q=>({id:q._id,content:q.content||'',category:q.category||'',difficulty:q.difficulty||'MEDIUM'}))}; }
async function publishNotebook(teacherId,event) { const classId=String(event.classId||''); const title=String(event.title||'班级错题练习').trim(); const ids=Array.isArray(event.questionIds)?event.questionIds.filter(Boolean):[]; if(!classId||!ids.length)return fail('请选择班级和题目'); const cls=(await db.collection('classes').doc(classId).get()).data; if(!cls||cls.teacherId!==teacherId)return fail('无权操作该班级'); const now=new Date().toISOString(); const r=await db.collection('class_notebooks').add({data:{teacherId,classId,title,questionIds:ids,isDeleted:false,createdAt:now,updatedAt:now}}); return {success:true,data:{id:r._id,title,questionCount:ids.length,createdAt:now}}; }
