<template>
  <div class="page">
    <van-nav-bar title="学员管理" left-arrow @click-left="$router.push('/teacher')" fixed placeholder />

    <div class="card">
      <h3>添加学生</h3>
      <p class="hint">让学生用邀请码自助绑定，或在这里直接按账号添加。</p>
      <div class="row">
        <input v-model="username" placeholder="学生账号" />
        <input v-model="remark" placeholder="备注（可选）" />
      </div>
      <button class="primary" :disabled="binding" @click="bind">{{ binding ? '添加中…' : '添加到我名下' }}</button>
    </div>

    <div v-if="!students.length" class="empty">还没有绑定学生。把邀请码发给学生，或用上面的账号添加。</div>

    <div v-for="s in students" :key="s.id" class="student" @click="$router.push('/teacher/students/' + s.id)">
      <div class="avatar">{{ (s.nickName || 'S').slice(0, 1) }}</div>
      <div class="body">
        <div class="name-row">
          <b>{{ s.nickName }}</b>
          <span class="uname">@{{ s.username }}</span>
          <span v-if="s.unread > 0" class="badge">{{ s.unread }}</span>
        </div>
        <div class="meta">
          错题 {{ s.questionCount }} · 本周 +{{ s.weekQuestions }} · 已掌握 {{ s.masteredCount }} · 连续打卡 {{ s.checkinStreak }} 天
        </div>
        <div v-if="s.remark" class="remark">备注：{{ s.remark }}</div>
      </div>
      <van-icon name="arrow" />
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
  name: 'TeacherStudents',
  components: { TeacherTabBar },
  setup() {
    const students = ref([])
    const username = ref('')
    const remark = ref('')
    const binding = ref(false)

    const load = async () => {
      const res = await teacherAPI.students()
      students.value = res.data || []
    }
    const bind = async () => {
      if (!username.value.trim()) {
        showToast('请填写学生账号')
        return
      }
      binding.value = true
      try {
        await teacherAPI.bindStudent(username.value.trim(), remark.value.trim())
        username.value = ''
        remark.value = ''
        await load()
        showToast({ type: 'success', message: '已添加' })
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '添加失败' })
      } finally {
        binding.value = false
      }
    }
    onMounted(() => load().catch(() => {}))
    return { students, username, remark, binding, bind }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 90px; background: #eef3fb; }
.card, .student { background: #fff; margin: 12px 16px; padding: 16px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.card h3 { margin: 0 0 6px; font-size: 15px; }
.hint { margin: 0 0 12px; font-size: 12px; color: rgba(11,22,51,0.5); }
.row { display: flex; gap: 8px; margin-bottom: 10px; }
.row input { flex: 1; height: 40px; border: none; background: #f4f7fb; border-radius: 10px; padding: 0 10px; min-width: 0; }
.primary { width: 100%; height: 42px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.empty { padding: 32px 24px; text-align: center; color: rgba(11,22,51,0.5); font-size: 13px; }
.student { display: flex; align-items: center; gap: 12px; cursor: pointer; }
.avatar { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.body { flex: 1; min-width: 0; }
.name-row { display: flex; align-items: center; gap: 6px; }
.name-row b { font-size: 15px; color: #0b1633; }
.uname { font-size: 12px; color: rgba(11,22,51,0.4); }
.badge { background: #e11d48; color: #fff; border-radius: 999px; padding: 0 6px; font-size: 11px; }
.meta { margin-top: 4px; font-size: 12px; color: rgba(11,22,51,0.55); }
.remark { margin-top: 2px; font-size: 12px; color: #2459ff; }
</style>
