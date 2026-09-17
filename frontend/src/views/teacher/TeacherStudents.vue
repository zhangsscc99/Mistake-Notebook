<template>
  <div class="page">
    <van-nav-bar :title="className || '班级学生'" left-arrow @click-left="$router.push('/teacher')" fixed placeholder />
    <div class="hero">
      <div class="kicker">CLASS</div>
      <h1>{{ className || '班级学生' }}</h1>
      <p>共 {{ students.length }} 人。输入昵称可快速找到学生</p>
    </div>
    <div class="search">
      <input v-model="keyword" placeholder="搜索学生昵称" />
      <button v-if="keyword" @click="keyword = ''">清除</button>
    </div>
    <div v-for="s in visible" :key="s.id" class="card row" @click="$router.push(`/teacher/students/${s.id}?classId=${classId}`)">
      <div class="avatar">{{ mark(s.nickName) }}</div>
      <div class="grow">
        <b>{{ s.nickName || '未设置昵称' }}</b>
        <span>错题 {{ s.questionCount || 0 }} 道 · 点开查看</span>
      </div>
      <span class="arrow">›</span>
    </div>
    <div v-if="!loading && !visible.length && students.length" class="empty">没有叫这个名字的学生</div>
    <div v-if="!loading && !students.length" class="empty">班级还没有学生</div>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import { markOf } from '../../utils/teacherClass'

export default {
  name: 'TeacherStudents',
  setup() {
    const route = useRoute()
    const classId = Number(route.query.classId || 0)
    const className = ref(route.query.name || '班级学生')
    const students = ref([])
    const keyword = ref('')
    const loading = ref(true)
    const mark = markOf
    const visible = computed(() => {
      const kw = keyword.value.trim()
      if (!kw) return students.value
      return students.value.filter((s) => (s.nickName || '').includes(kw) || (s.username || '').includes(kw))
    })
    onMounted(async () => {
      try {
        if (!classId) {
          const dash = await teacherAPI.dashboard()
          const first = (dash.data && dash.data.classes || [])[0]
          if (first) {
            className.value = first.name
            const res = await teacherAPI.classStudents(first.id)
            students.value = res.data || []
          }
        } else {
          const res = await teacherAPI.classStudents(classId)
          students.value = res.data || []
        }
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })
      } finally {
        loading.value = false
      }
    })
    return { classId: classId || undefined, className, students, keyword, visible, loading, mark }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 24px; background: #eef3fb; }
.hero { margin: 12px 16px; background: linear-gradient(135deg, #2459ff, #52b7ff); border-radius: 20px; padding: 18px; color: #fff; }
.kicker { font-size: 12px; opacity: 0.85; }
.hero h1 { margin: 4px 0 6px; font-size: 22px; }
.hero p { margin: 0; font-size: 13px; opacity: 0.88; }
.search { margin: 0 16px 10px; display: flex; background: #fff; border-radius: 12px; padding: 0 12px; }
.search input { flex: 1; height: 40px; border: none; }
.search button { border: none; background: none; color: #2459ff; font-weight: 700; }
.card { background: #fff; margin: 0 16px 8px; padding: 14px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.row { display: flex; align-items: center; gap: 12px; cursor: pointer; }
.avatar { width: 40px; height: 40px; border-radius: 50%; background: #eaf1ff; color: #2459ff; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.grow { flex: 1; display: flex; flex-direction: column; }
.grow span { font-size: 12px; color: rgba(11,22,51,0.5); margin-top: 4px; }
.arrow { color: rgba(11,22,51,0.3); }
.empty { text-align: center; padding: 24px; color: rgba(11,22,51,0.45); }
</style>
