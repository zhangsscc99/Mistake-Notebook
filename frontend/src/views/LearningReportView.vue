<template>
  <div class="page">
    <van-nav-bar :title="report.title || '报告'" left-arrow @click-left="$router.back()" fixed placeholder />
    <div class="head">
      <b>{{ report.title }}</b>
      <span v-if="report.overview" class="sub">{{ report.overview }}</span>
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
  name: 'LearningReportView',
  components: { SectionedReport },
  setup() {
    const route = useRoute()
    const report = ref({})
    onMounted(async () => {
      const res = await studyAPI.getLearningReport(route.params.id)
      report.value = res.data || {}
    })
    return { report }
  }
}
</script>
<style scoped>
.page { min-height: 100vh; background: #eef3fb; padding: 0 16px 32px; }
.head { padding: 14px 0; display: flex; flex-direction: column; gap: 4px; }
.head b { font-size: 18px; color: #0b1633; }
.sub { font-size: 12px; color: rgba(11,22,51,0.45); }
</style>
