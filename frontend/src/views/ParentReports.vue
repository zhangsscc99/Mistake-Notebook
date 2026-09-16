<template>
  <div class="page">
    <van-nav-bar title="家长端报告" left-arrow @click-left="$router.back()" fixed placeholder />

    <template v-if="!current">
      <div v-if="!list.length" class="empty">老师还没有生成报告。</div>
      <div v-for="r in list" :key="r.id" class="card" @click="open(r)">
        <b>{{ r.title }}</b>
        <span class="time">{{ fmt(r.createdAt) }}</span>
      </div>
    </template>

    <template v-else>
      <div class="report-head">
        <b>{{ current.title }}</b>
        <span class="time">{{ fmt(current.createdAt) }}</span>
        <button class="ghost" @click="current = null">返回列表</button>
      </div>
      <SectionedReport :content="current.content" />
    </template>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import classroomAPI from '../api/classroom'
import SectionedReport from '../components/SectionedReport.vue'

export default {
  name: 'ParentReports',
  components: { SectionedReport },
  setup() {
    const route = useRoute()
    const list = ref([])
    const current = ref(null)

    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })

    const open = async (r) => {
      try {
        const res = await classroomAPI.parentReport(r.id)
        current.value = res.data || null
      } catch (e) { fail(e) }
    }

    onMounted(async () => {
      try {
        const res = await classroomAPI.parentReports()
        list.value = res.data || []
        if (route.params.id) {
          const hit = list.value.find((x) => String(x.id) === String(route.params.id))
          if (hit) await open(hit)
        }
      } catch (e) { fail(e) }
    })

    const fmt = (t) => (t ? String(t).replace('T', ' ').slice(0, 16) : '')
    return { list, current, open, fmt }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 0 16px 32px; background: #eef3fb; }
.card { background: #fff; margin: 12px 0; padding: 16px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); display: flex; flex-direction: column; gap: 4px; cursor: pointer; }
.card b { font-size: 15px; color: #0b1633; }
.time { font-size: 12px; color: rgba(11,22,51,0.45); }
.report-head { padding: 14px 0; display: flex; flex-direction: column; gap: 4px; }
.report-head b { font-size: 18px; color: #0b1633; }
.ghost { align-self: flex-start; margin-top: 8px; border: none; background: #fff; color: #2459ff; border-radius: 999px; padding: 7px 14px; font-weight: 700; }
.empty { padding: 40px 8px; text-align: center; color: rgba(11,22,51,0.5); font-size: 13px; }
</style>
