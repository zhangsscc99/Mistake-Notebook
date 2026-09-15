<template>
  <div class="page">
    <van-nav-bar :title="report.title || '报告'" left-arrow @click-left="$router.back()" />
    <article class="body">{{ report.content }}</article>
  </div>
</template>
<script>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import studyAPI from '../api/study'
export default {
  name: 'LearningReportView',
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
.page { min-height: 100vh; background: #eef3fb; }
.body { white-space: pre-wrap; background: #fff; margin: 16px; padding: 18px; border-radius: 16px; line-height: 1.7; color: #0b1633; }
</style>
