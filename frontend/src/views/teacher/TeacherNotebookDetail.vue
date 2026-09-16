<template>
  <div class="page">
    <van-nav-bar :title="nb.title || '班级错题本'" left-arrow @click-left="$router.back()" fixed placeholder />

    <div class="card">
      <p v-if="nb.description" class="desc">{{ nb.description }}</p>
      <div class="meta">{{ nb.questionCount }} 题 · {{ nb.pushedAt ? '已推送 ' + fmt(nb.pushedAt) : '未推送' }}</div>
    </div>

    <div class="card">
      <h3>学生练习进度</h3>
      <div v-if="!nb.progress?.length" class="empty">还没有学生开始练习。</div>
      <div v-for="p in nb.progress || []" :key="p.id" class="prog">
        <span class="pname">{{ p.nickName }}</span>
        <div class="track"><i :style="{ width: rate(p) + '%' }"></i></div>
        <span class="pnum">{{ p.doneCount }}/{{ p.totalCount || nb.questionCount }}</span>
      </div>
    </div>

    <div class="card">
      <h3>题目（{{ nb.questions?.length || 0 }}）</h3>
      <div v-for="(q, i) in nb.questions || []" :key="i" class="q">
        <div class="q-meta">
          <span class="idx">#{{ i + 1 }}</span>
          <span v-if="q.tag" class="tag">{{ q.tag }}</span>
          <span v-if="q.category" class="tag">{{ q.category }}</span>
        </div>
        <p class="q-content">{{ q.content }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import teacherAPI from '../../api/teacher'

export default {
  name: 'TeacherNotebookDetail',
  setup() {
    const route = useRoute()
    const nb = ref({})
    onMounted(async () => {
      try {
        const res = await teacherAPI.notebook(route.params.id)
        nb.value = res.data || {}
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })
      }
    })
    const rate = (p) => {
      const total = p.totalCount || nb.value.questionCount || 1
      return Math.min(100, Math.round((p.doneCount / total) * 100))
    }
    const fmt = (t) => (t ? String(t).replace('T', ' ').slice(0, 16) : '')
    return { nb, rate, fmt }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 32px; background: #eef3fb; }
.card { background: #fff; margin: 12px 16px; padding: 16px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.card h3 { margin: 0 0 10px; font-size: 15px; }
.desc { margin: 0 0 8px; font-size: 13px; color: rgba(11,22,51,0.6); }
.meta { font-size: 12px; color: rgba(11,22,51,0.5); }
.prog { display: grid; grid-template-columns: 80px 1fr 50px; gap: 8px; align-items: center; margin-bottom: 10px; font-size: 13px; }
.pname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track { height: 8px; background: #eef3fb; border-radius: 99px; overflow: hidden; }
.track i { display: block; height: 100%; background: linear-gradient(90deg,#2459ff,#52b7ff); }
.pnum { text-align: right; font-size: 12px; color: rgba(11,22,51,0.5); }
.q { padding: 10px 0; border-top: 1px solid rgba(11,22,51,0.05); }
.q-meta { display: flex; gap: 8px; font-size: 12px; color: rgba(11,22,51,0.5); }
.idx { font-weight: 800; color: #2459ff; }
.q-content { margin: 6px 0 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
.empty { padding: 20px; text-align: center; color: rgba(11,22,51,0.45); font-size: 13px; }
</style>
