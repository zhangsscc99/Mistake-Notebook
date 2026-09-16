<template>
  <div class="page">
    <van-nav-bar title="我的作业" left-arrow @click-left="$router.back()" fixed placeholder />

    <div v-if="!list.length" class="empty">还没有收到作业。</div>

    <div v-for="hw in list" :key="hw.id" class="card" @click="$router.push('/homework/' + hw.id)">
      <div class="head">
        <b>{{ hw.title }}</b>
        <span class="pill" :class="statusClass(hw)">{{ statusText(hw) }}</span>
      </div>
      <p v-if="hw.description" class="desc">{{ hw.description }}</p>
      <div class="meta">
        {{ hw.questionCount }} 题
        <span v-if="hw.teacherName"> · {{ hw.teacherName }} 老师</span>
        <span v-if="hw.dueAt"> · 截止 {{ fmt(hw.dueAt) }}</span>
      </div>
    </div>

    <AppTabBar />
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { showToast } from 'vant'
import classroomAPI from '../api/classroom'
import AppTabBar from '../components/AppTabBar.vue'

export default {
  name: 'StudentHomework',
  components: { AppTabBar },
  setup() {
    const list = ref([])
    onMounted(async () => {
      try {
        const res = await classroomAPI.homework()
        list.value = res.data || []
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })
      }
    })
    const statusText = (hw) => {
      if (hw.status === 'GRADED') return '已批改 ' + (hw.score ?? 0) + ' 分'
      if (hw.status === 'SUBMITTED') return '已提交'
      return hw.overdue ? '已逾期' : '待完成'
    }
    const statusClass = (hw) => {
      if (hw.status === 'GRADED') return 'ok'
      if (hw.status === 'SUBMITTED') return 'info'
      return hw.overdue ? 'hot' : 'todo'
    }
    const fmt = (t) => (t ? String(t).replace('T', ' ').slice(0, 16) : '')
    return { list, statusText, statusClass, fmt }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 90px; background: #eef3fb; }
.card { background: #fff; margin: 12px 16px; padding: 16px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); cursor: pointer; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.head b { font-size: 15px; color: #0b1633; }
.pill { font-size: 11px; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
.pill.ok { background: rgba(22,163,74,0.12); color: #16a34a; }
.pill.info { background: rgba(36,89,255,0.12); color: #2459ff; }
.pill.hot { background: rgba(225,29,72,0.12); color: #e11d48; }
.pill.todo { background: #f4f7fb; color: rgba(11,22,51,0.55); }
.desc { margin: 8px 0 0; font-size: 13px; color: rgba(11,22,51,0.6); }
.meta { margin-top: 8px; font-size: 12px; color: rgba(11,22,51,0.5); }
.empty { padding: 40px 24px; text-align: center; color: rgba(11,22,51,0.5); font-size: 13px; }
</style>
