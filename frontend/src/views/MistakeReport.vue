<template>
  <div class="page">
    <van-nav-bar :title="report.questionCount > 1 ? '错因深度分析' : '错因分析'" left-arrow @click-left="$router.back()" fixed placeholder />
    <div class="head">
      <b>{{ report.title }}</b>
      <span v-if="report.questionCount > 1" class="pill">综合 {{ report.questionCount }} 道错题</span>
    </div>
    <SectionedReport :content="report.content || ''" />
  </div>
</template>
<script>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import studyAPI from '../api/study'
import SectionedReport from '../components/SectionedReport.vue'
export default {
  name: 'MistakeReportView',
  components: { SectionedReport },
  setup() {
    const route = useRoute()
    const report = ref({})
    onMounted(async () => {
      const res = await studyAPI.getMistakeReport(route.params.id)
      report.value = res.data || {}
    })
    return { report }
  }
}
</script>
<style scoped>
.page { min-height: 100vh; background: #eef3fb; padding: 0 16px 32px; }
.head { padding: 14px 0; display: flex; flex-direction: column; gap: 6px; }
.head b { font-size: 17px; color: #0b1633; line-height: 1.5; }
.pill { align-self: flex-start; font-size: 11px; padding: 3px 10px; border-radius: 999px; background: rgba(36,89,255,0.12); color: #2459ff; font-weight: 700; }
</style>
