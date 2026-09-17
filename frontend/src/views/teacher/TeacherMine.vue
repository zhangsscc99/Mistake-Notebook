<template>
  <div class="page">
    <div class="hero">
      <div class="kicker">TEACHER</div>
      <h1>{{ profile.nickName || '教师' }}</h1>
      <p>拍照录入进班级题库，不进个人错题本。组卷前请先到题目页选题。</p>
      <div class="hero-stats">
        <div class="hero-stat" @click="$router.push('/teacher')"><b>{{ dash.classCount }}</b><span>班级</span></div>
        <div class="hero-stat" @click="$router.push('/teacher')"><b>{{ dash.studentCount || 0 }}</b><span>学生</span></div>
        <div class="hero-stat" @click="$router.push('/teacher/homework')"><b>{{ dash.assignmentCount || 0 }}</b><span>作业</span></div>
      </div>
    </div>

    <div class="section-head">教学</div>
    <div class="card list">
      <button @click="$router.push('/teacher/homework')">作业批改 <span>›</span></button>
      <button @click="$router.push('/teacher/paper')">班级组卷 <span>›</span></button>
      <button @click="$router.push('/teacher/report')">家长报告 <span>›</span></button>
      <button @click="$router.push('/teacher/questions')">全班题目 <span>›</span></button>
      <button @click="$router.push('/teacher/class-notebooks')">班级错题本 <span>›</span></button>
      <button @click="$router.push('/teacher/analytics')">教学效果分析 <span>›</span></button>
      <button @click="$router.push('/profile')">资料与密码 <span>›</span></button>
      <button @click="$router.push('/teacher/org')">我的机构主页 <span>›</span></button>
      <button @click="$router.push('/orgs')">机构目录 <span>›</span></button>
      <button @click="$router.push('/community')">学习社区 <span>›</span></button>
    </div>

    <div class="section-head">账号</div>
    <div class="card list">
      <button @click="logout">退出登录 <span>›</span></button>
      <button class="danger" @click="deleteAccount">注销账号 <span>›</span></button>
    </div>
    <p class="foot">本账号已绑定老师身份。退出登录不会改变身份；更换身份需要先注销账号。</p>
    <TeacherTabBar />
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import userAPI from '../../api/user'
import TeacherTabBar from '../../components/TeacherTabBar.vue'
import { clearSession, getProfile } from '../../utils/auth'

export default {
  name: 'TeacherMine',
  components: { TeacherTabBar },
  setup() {
    const router = useRouter()
    const profile = getProfile() || {}
    const dash = ref({ classCount: 0 })
    onMounted(async () => {
      try {
        const res = await teacherAPI.dashboard()
        const d = res.data || {}
        dash.value = { ...d, classCount: (d.classes || []).length }
      } catch { /* ignore */ }
    })
    const logout = async () => {
      await showConfirmDialog({ title: '退出登录', message: '确定退出当前教师账号？' })
      clearSession()
      router.replace('/login')
    }
    const deleteAccount = async () => {
      await showConfirmDialog({
        title: '注销账号',
        message: '将删除本账号的班级、题库与作业数据，且不可恢复。',
        confirmButtonText: '注销',
        confirmButtonColor: '#e11d48'
      })
      try {
        await userAPI.deleteAccount()
        clearSession()
        showToast({ type: 'success', message: '账号已注销' })
        router.replace('/login')
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '注销失败' })
      }
    }
    return { profile, dash, logout, deleteAccount }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 20px 16px 90px; background: #eef3fb; }
.hero { background: linear-gradient(135deg, #2459ff, #52b7ff); border-radius: 20px; padding: 18px; color: #fff; margin-bottom: 12px; }
.kicker { font-size: 12px; opacity: 0.85; }
.hero h1 { margin: 4px 0 6px; font-size: 22px; }
.hero p { margin: 0; font-size: 13px; opacity: 0.88; }
.hero-stats { margin-top: 14px; display: flex; background: rgba(255,255,255,0.18); border-radius: 14px; }
.hero-stat { flex: 1; text-align: center; padding: 10px 0; }
.hero-stat b { display: block; font-size: 18px; }
.hero-stat span { font-size: 11px; }
.section-head { margin: 16px 2px 8px; font-weight: 800; }
.card.list { background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(11,22,51,0.06); }
.card.list button { width: 100%; display: flex; justify-content: space-between; background: none; border: none; padding: 14px 16px; font-size: 15px; color: #0b1633; border-top: 1px solid rgba(11,22,51,0.06); }
.card.list button:first-child { border-top: none; }
.card.list span { color: rgba(11,22,51,0.3); }
.danger { color: #e11d48 !important; }
.foot { margin: 14px 4px; font-size: 12px; color: rgba(11,22,51,0.45); line-height: 1.5; }
</style>
