<template>
  <div class="page">
    <van-nav-bar title="班级错题本" left-arrow @click-left="$router.back()" fixed placeholder />

    <div v-if="!list.length" class="empty">老师还没有推送班级错题本。</div>

    <div v-for="nb in list" :key="nb.id" class="card" @click="$router.push('/class-notebooks/' + nb.id)">
      <div class="head">
        <b>{{ nb.title }}</b>
        <span class="pill">{{ nb.doneCount }}/{{ nb.questionCount }}</span>
      </div>
      <p v-if="nb.description" class="desc">{{ nb.description }}</p>
      <div class="track"><i :style="{ width: rate(nb) + '%' }"></i></div>
      <div class="meta">{{ nb.className || nb.teacherName || '老师' }} · {{ fmt(nb.pushedAt || nb.createdAt) }}</div>
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
  name: 'ClassNotebooks',
  components: { AppTabBar },
  setup() {
    const list = ref([])
    onMounted(async () => {
      try {
        const res = await classroomAPI.notebooks()
        list.value = res.data || []
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })
      }
    })
    const rate = (nb) => Math.min(100, Math.round((nb.doneCount / Math.max(1, nb.questionCount)) * 100))
    const fmt = (t) => (t ? String(t).replace('T', ' ').slice(0, 16) : '')
    return { list, rate, fmt }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 90px; background: #eef3fb; }
.card { background: #fff; margin: 12px 16px; padding: 16px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); cursor: pointer; }
.head { display: flex; justify-content: space-between; align-items: center; }
.head b { font-size: 15px; color: #0b1633; }
.pill { font-size: 12px; color: #2459ff; font-weight: 700; }
.desc { margin: 8px 0; font-size: 13px; color: rgba(11,22,51,0.6); }
.track { height: 8px; background: #eef3fb; border-radius: 99px; overflow: hidden; margin: 10px 0 8px; }
.track i { display: block; height: 100%; background: linear-gradient(90deg,#2459ff,#52b7ff); }
.meta { font-size: 12px; color: rgba(11,22,51,0.5); }
.empty { padding: 40px 24px; text-align: center; color: rgba(11,22,51,0.5); font-size: 13px; }
</style>
