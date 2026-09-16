<template>
  <div class="page">
    <van-nav-bar title="开始练习" left-arrow @click-left="$router.back()" fixed placeholder />

    <div v-if="loading" class="empty">正在准备题目…</div>
    <div v-else-if="!questions.length" class="empty">
      没有可练的题目。{{ onlyUnmastered ? '这个分类的题都已标记为掌握。' : '先去拍照录入错题吧。' }}
      <button v-if="onlyUnmastered" class="ghost" @click="reload(false)">练全部题目</button>
    </div>

    <template v-else-if="!finished">
      <div class="progress-bar">
        <span>第 {{ index + 1 }} / {{ questions.length }} 题 · 已掌握 {{ masteredCount }}</span>
        <div class="track"><i :style="{ width: ((index + 1) / questions.length) * 100 + '%' }"></i></div>
      </div>

      <div class="card">
        <div class="q-meta">
          <span class="tag">{{ current.category }}</span>
          <span class="diff" :class="'d-' + current.difficulty">{{ diffText(current.difficulty) }}</span>
          <span v-if="current.mastered" class="mastered">已掌握</span>
        </div>
        <p class="q-content">{{ current.content }}</p>

        <button v-if="!revealed" class="primary" @click="revealed = true">显示答案</button>
        <div v-else class="answer">
          <b>答案</b>
          <p>{{ current.answer || '暂无' }}</p>
          <b>解析</b>
          <p>{{ current.analysis || '暂无' }}</p>
          <button class="ghost" @click="$router.push('/explain/' + current.id)">看详细讲解</button>
        </div>
      </div>

      <div v-if="revealed" class="judge">
        <button class="ghost danger" @click="judge(false)">还不会</button>
        <button class="primary slim" @click="judge(true)">我会了</button>
      </div>
    </template>

    <div v-else class="card done">
      <b>练完啦</b>
      <p>本次练习 {{ questions.length }} 题，标记「我会了」{{ masteredCount }} 题。</p>
      <button class="primary" @click="$router.back()">返回</button>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import studyAPI from '../api/study'

export default {
  name: 'PracticePage',
  setup() {
    const route = useRoute()
    const questions = ref([])
    const index = ref(0)
    const revealed = ref(false)
    const masteredCount = ref(0)
    const finished = ref(false)
    const loading = ref(true)
    const onlyUnmastered = ref(true)

    const current = computed(() => questions.value[index.value] || {})

    const reload = async (unmasteredOnly) => {
      onlyUnmastered.value = unmasteredOnly
      loading.value = true
      finished.value = false
      index.value = 0
      revealed.value = false
      masteredCount.value = 0
      try {
        const params = { onlyUnmastered: unmasteredOnly }
        if (route.query.categoryId) params.categoryId = route.query.categoryId
        const res = await studyAPI.practice(params)
        questions.value = res.data || []
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })
      } finally {
        loading.value = false
      }
    }

    const judge = async (mastered) => {
      const q = current.value
      if (mastered) {
        masteredCount.value += 1
        try {
          await studyAPI.updateMark({ questionId: q.id, mastered: true })
        } catch { /* 标记失败不阻断练习 */ }
      }
      const next = index.value + 1
      if (next >= questions.value.length) {
        finished.value = true
        return
      }
      index.value = next
      revealed.value = false
    }

    const diffText = (d) => ({ easy: '简单', medium: '中等', hard: '困难' }[d] || '中等')
    onMounted(() => reload(true))
    return { questions, index, revealed, current, masteredCount, finished, loading, onlyUnmastered, reload, judge, diffText }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40px; background: #eef3fb; }
.progress-bar { margin: 12px 16px 0; font-size: 12px; color: rgba(11,22,51,0.55); }
.track { height: 6px; background: #fff; border-radius: 99px; overflow: hidden; margin-top: 6px; }
.track i { display: block; height: 100%; background: linear-gradient(90deg,#2459ff,#52b7ff); }
.card { background: #fff; margin: 12px 16px; padding: 18px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.q-meta { display: flex; gap: 8px; align-items: center; font-size: 12px; color: rgba(11,22,51,0.5); }
.tag { background: #f4f7fb; border-radius: 999px; padding: 3px 10px; }
.d-easy { color: #16a34a; }
.d-hard { color: #e11d48; }
.mastered { margin-left: auto; color: #16a34a; font-weight: 700; }
.q-content { margin: 12px 0 16px; font-size: 16px; line-height: 1.7; white-space: pre-wrap; color: #0b1633; }
.answer { background: #f9fbff; border-radius: 12px; padding: 12px; font-size: 14px; }
.answer p { margin: 4px 0 10px; white-space: pre-wrap; line-height: 1.65; }
.primary { width: 100%; height: 44px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.primary.slim { width: auto; padding: 0 22px; height: 42px; }
.judge { display: flex; gap: 10px; justify-content: space-between; margin: 0 16px; }
.ghost { border: none; background: #eef3fb; color: #2459ff; border-radius: 999px; padding: 9px 16px; font-weight: 700; }
.ghost.danger { background: #fff; color: #e11d48; border: 1px solid rgba(225,29,72,0.25); height: 42px; padding: 0 22px; }
.done { text-align: center; }
.done b { font-size: 18px; }
.done p { margin: 8px 0 14px; font-size: 13px; color: rgba(11,22,51,0.6); }
.empty { padding: 40px 24px; text-align: center; color: rgba(11,22,51,0.5); font-size: 13px; }
.empty .ghost { margin-top: 14px; }
</style>
