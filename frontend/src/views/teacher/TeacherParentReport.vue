<template>
  <div class="page">
    <van-nav-bar title="家长端报告" left-arrow @click-left="$router.back()" fixed placeholder />
    <div class="head">
      <b>{{ report.title }}</b>
      <span class="time">{{ fmt(report.createdAt) }}</span>
    </div>
    <SectionedReport :content="report.content || ''" />
    <button class="ghost" @click="copy">复制全文发给家长</button>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import SectionedReport from '../../components/SectionedReport.vue'

export default {
  name: 'TeacherParentReport',
  components: { SectionedReport },
  setup() {
    const route = useRoute()
    const report = ref({})
    onMounted(async () => {
      try {
        const res = await teacherAPI.parentReport(route.params.id)
        report.value = res.data || {}
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })
      }
    })
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(`${report.value.title}\n\n${report.value.content}`)
        showToast({ type: 'success', message: '已复制' })
      } catch {
        showToast('长按选择文字复制')
      }
    }
    const fmt = (t) => (t ? String(t).replace('T', ' ').slice(0, 16) : '')
    return { report, copy, fmt }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 0 16px 32px; background: #eef3fb; }
.head { padding: 14px 0; display: flex; flex-direction: column; gap: 4px; }
.head b { font-size: 18px; color: #0b1633; }
.time { font-size: 12px; color: rgba(11,22,51,0.45); }
.ghost { width: 100%; margin-top: 16px; border: none; background: #fff; color: #2459ff; border-radius: 999px; padding: 12px; font-weight: 700; }
</style>
