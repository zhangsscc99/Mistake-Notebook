<template>
  <div class="page">
    <div class="hero">
      <div class="hero-row">
        <div>
          <div class="kicker">教师管理后台</div>
          <h1>{{ dash.teacher?.nickName || '老师' }}</h1>
          <p>{{ dash.teacher?.school || '未填学校' }} · {{ dash.teacher?.className || '未填班级' }}</p>
        </div>
        <button class="ghost" @click="$router.push('/profile')">我的资料</button>
      </div>
      <div class="invite">
        <div>
          <span class="invite-label">学生绑定邀请码</span>
          <b class="invite-code">{{ dash.inviteCode || '—' }}</b>
        </div>
        <button class="ghost" @click="copyCode">复制</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat"><b>{{ dash.studentCount || 0 }}</b><span>名下学生</span></div>
      <div class="stat"><b>{{ dash.totalQuestions || 0 }}</b><span>错题总数</span></div>
      <div class="stat"><b>{{ dash.weekQuestions || 0 }}</b><span>本周新增</span></div>
      <div class="stat" :class="{ hot: dash.pendingGrade > 0 }"><b>{{ dash.pendingGrade || 0 }}</b><span>待批改</span></div>
    </div>

    <div class="entry-grid">
      <div class="entry" @click="$router.push('/teacher/students')">
        <div class="entry-mark">生</div>
        <div class="entry-body">
          <b>学员管理</b>
          <span>查看名下学生、学习情况与留言</span>
        </div>
        <span v-if="dash.unreadMessages > 0" class="badge">{{ dash.unreadMessages }}</span>
      </div>
      <div class="entry" @click="$router.push('/teacher/class-notebooks')">
        <div class="entry-mark">册</div>
        <div class="entry-body">
          <b>班级错题本</b>
          <span>把高频错题整理成册，推送全班练习</span>
        </div>
      </div>
      <div class="entry" @click="$router.push('/teacher/homework')">
        <div class="entry-mark">业</div>
        <div class="entry-body">
          <b>作业布置与批改</b>
          <span>布置作业、AI 预批改、逐题打分</span>
        </div>
        <span v-if="dash.pendingGrade > 0" class="badge">{{ dash.pendingGrade }}</span>
      </div>
      <div class="entry" @click="$router.push('/teacher/analytics')">
        <div class="entry-mark">析</div>
        <div class="entry-body">
          <b>教学效果分析</b>
          <span>掌握率、活跃度、高频薄弱知识点</span>
        </div>
      </div>
    </div>

    <TeacherTabBar />
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import TeacherTabBar from '../../components/TeacherTabBar.vue'

export default {
  name: 'TeacherHome',
  components: { TeacherTabBar },
  setup() {
    const dash = ref({})
    const load = async () => {
      const res = await teacherAPI.dashboard()
      dash.value = res.data || {}
    }
    const copyCode = async () => {
      const code = dash.value.inviteCode
      if (!code) return
      try {
        await navigator.clipboard.writeText(code)
        showToast({ type: 'success', message: '邀请码已复制' })
      } catch {
        showToast('邀请码：' + code)
      }
    }
    onMounted(() => load().catch((e) => showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })))
    return { dash, copyCode }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 20px 16px 90px; background: #eef3fb; }
.hero { background: linear-gradient(135deg, #2459ff, #52b7ff); border-radius: 20px; padding: 18px; color: #fff; margin-bottom: 14px; }
.hero-row { display: flex; justify-content: space-between; align-items: flex-start; }
.kicker { font-size: 12px; opacity: 0.85; }
.hero h1 { margin: 4px 0; font-size: 22px; }
.hero p { margin: 0; font-size: 13px; opacity: 0.85; }
.invite { margin-top: 16px; background: rgba(255,255,255,0.18); border-radius: 12px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; }
.invite-label { display: block; font-size: 12px; opacity: 0.85; }
.invite-code { font-size: 20px; letter-spacing: 3px; font-weight: 800; }
.ghost { border: none; background: rgba(255,255,255,0.22); color: #fff; border-radius: 999px; padding: 8px 14px; font-weight: 700; }
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
.stat { background: #fff; border-radius: 14px; padding: 12px 6px; text-align: center; border: 1px solid rgba(11,22,51,0.06); }
.stat b { display: block; font-size: 20px; color: #0b1633; }
.stat span { font-size: 11px; color: rgba(11,22,51,0.5); }
.stat.hot b { color: #e11d48; }
.entry-grid { display: flex; flex-direction: column; gap: 10px; }
.entry { background: #fff; border-radius: 16px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; border: 1px solid rgba(11,22,51,0.06); cursor: pointer; }
.entry-mark { width: 42px; height: 42px; border-radius: 12px; background: rgba(36,89,255,0.12); color: #2459ff; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.entry-body { flex: 1; display: flex; flex-direction: column; }
.entry-body b { font-size: 15px; color: #0b1633; }
.entry-body span { font-size: 12px; color: rgba(11,22,51,0.5); }
.badge { background: #e11d48; color: #fff; border-radius: 999px; min-width: 20px; height: 20px; padding: 0 6px; font-size: 12px; line-height: 20px; text-align: center; }
</style>
