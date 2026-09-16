<template>
  <div class="page">
    <van-nav-bar title="错题讲解" left-arrow @click-left="$router.back()" fixed placeholder>
      <template #right>
        <span class="nav-action" @click="load(true)">重新讲</span>
      </template>
    </van-nav-bar>

    <div v-if="question.content" class="card q">
      <span class="label">题目</span>
      <p>{{ question.content }}</p>
    </div>

    <div v-if="loading" class="empty">老师正在备课，10 秒左右…</div>
    <SectionedReport v-else :content="explanation" />

    <div v-if="!loading" class="footer">
      <button class="ghost" @click="goChat">还有不懂，问对话助手</button>
    </div>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import studyAPI from '../api/study'
import { apiClient } from '../api/config'
import SectionedReport from '../components/SectionedReport.vue'

export default {
  name: 'QuestionExplain',
  components: { SectionedReport },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const questionId = route.params.id
    const question = ref({})
    const explanation = ref('')
    const loading = ref(true)

    const load = async (refresh = false) => {
      loading.value = true
      try {
        const res = await studyAPI.explainQuestion(questionId, refresh)
        explanation.value = res.data?.content || ''
        if (refresh) showToast({ type: 'success', message: '已重新讲解' })
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '讲解失败' })
      } finally {
        loading.value = false
      }
    }

    const goChat = () => {
      const ctx = question.value.content || ''
      router.push({ path: '/ai-chat', query: { context: encodeURIComponent(ctx) } })
    }

    onMounted(async () => {
      try {
        const res = await apiClient.get('/questions/' + questionId)
        question.value = res.data?.data || {}
      } catch { /* 题面加载失败不影响讲解 */ }
      await load(false)
    })

    return { question, explanation, loading, load, goChat }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 0 16px 32px; background: #eef3fb; }
.nav-action { color: #2459ff; font-weight: 700; font-size: 14px; }
.card { background: #fff; border-radius: 16px; padding: 16px; margin: 12px 0; border: 1px solid rgba(11,22,51,0.06); }
.label { font-size: 12px; color: rgba(11,22,51,0.45); }
.q p { margin: 6px 0 0; font-size: 15px; line-height: 1.7; white-space: pre-wrap; color: #0b1633; }
.empty { padding: 40px 8px; text-align: center; color: rgba(11,22,51,0.5); font-size: 13px; }
.footer { margin-top: 16px; }
.ghost { width: 100%; border: none; background: #fff; color: #2459ff; border-radius: 999px; padding: 12px; font-weight: 700; }
</style>
