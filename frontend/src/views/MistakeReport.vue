<template>
  <div class="page">
    <van-nav-bar title="错因分析" left-arrow @click-left="$router.back()" />
    <article class="body">{{ report.content }}</article>
  </div>
</template>
<script>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import studyAPI from '../api/study'
export default {
  name: 'MistakeReportView',
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
.page { min-height: 100vh; background: #eef3fb; }
.body { white-space: pre-wrap; background: #fff; margin: 16px; padding: 18px; border-radius: 16px; line-height: 1.7; }
</style>
