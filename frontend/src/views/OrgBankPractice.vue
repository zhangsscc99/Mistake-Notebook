<template>
  <div class="page">
    <van-nav-bar :title="title" left-arrow @click-left="$router.back()" fixed placeholder />

    <div v-if="loading" class="empty">正在准备题目…</div>
    <div v-else-if="!questions.length" class="empty">
      {{ onlyUnmastered ? '这些题都已标记掌握。' : '老师还没有写入专属题目。' }}
      <button v-if="onlyUnmastered" class="ghost" type="button" @click="reload(false)">练全部题目</button>
    </div>

    <template v-else-if="!finished">
      <div class="progress-bar">
        <span>第 {{ index + 1 }} / {{ questions.length }} 题 · 已掌握 {{ masteredCount }}</span>
        <div class="track"><i :style="{ width: ((index + 1) / questions.length) * 100 + '%' }"></i></div>
      </div>

      <div class="card">
        <div class="q-meta">
          <span class="tag">{{ current.category || '未分类' }}</span>
          <span class="diff">{{ diffLabel(current.difficulty) }}</span>
          <span v-if="current.mastered" class="ok">已掌握</span>
        </div>
        <p class="q-content">{{ current.content }}</p>
        <img v-if="current.imageUrl" class="q-img" :src="current.imageUrl" alt="" />

        <button v-if="!revealed" class="primary" type="button" @click="revealed = true">显示答案</button>
        <div v-else class="answer">
          <b>参考答案</b>
          <p>{{ current.answer || '暂无' }}</p>
          <b>解析</b>
          <p>{{ current.analysis || '暂无' }}</p>
        </div>
      </div>

      <div v-if="revealed" class="judge">
        <button class="ghost" type="button" @click="judge(false)">还不会</button>
        <button class="primary slim" type="button" @click="judge(true)">我会了</button>
      </div>
    </template>

    <div v-else class="card done">
      <b>练完啦</b>
      <p>本次练习 {{ questions.length }} 题，标记「我会了」{{ sessionMastered }} 题。</p>
      <button class="primary" type="button" @click="$router.replace('/orgs/' + slug + '/bank')">返回题库</button>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import orgAPI from '../api/org'

export default {
  name: 'OrgBankPractice',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const slug = computed(() => String(route.params.slug || ''))
    const title = ref('机构练习')
    const questions = ref([])
    const index = ref(0)
    const revealed = ref(false)
    const masteredCount = ref(0)
    const sessionMastered = ref(0)
    const finished = ref(false)
    const loading = ref(true)
    const onlyUnmastered = ref(route.query.unmastered === '1')
    const current = computed(() => questions.value[index.value] || {})

    const diffLabel = (d) => {
      const v = String(d || '').toUpperCase()
      if (v === 'EASY' || v === '简单') return '简单'
      if (v === 'HARD' || v === '困难') return '困难'
      return '中等'
    }

    const pickIds = () => String(route.query.ids || '')
      .split(',')
      .map((s) => Number(s))
      .filter((n) => n > 0)

    const reload = async (unmasteredOnly) => {
      onlyUnmastered.value = unmasteredOnly
      loading.value = true
      finished.value = false
      index.value = 0
      revealed.value = false
      sessionMastered.value = 0
      try {
        const [detail, rows] = await Promise.all([
          orgAPI.detail(slug.value).catch(() => ({ data: {} })),
          orgAPI.memberPractice(slug.value, unmasteredOnly)
        ])
        const name = detail.data?.shortName || detail.data?.name
        if (name) title.value = name + '练习'
        let list = rows.data || []
        const ids = pickIds()
        if (ids.length) {
          const allow = new Set(ids)
          list = list.filter((q) => allow.has(Number(q.id)))
        }
        questions.value = list
        masteredCount.value = list.filter((q) => q.mastered).length
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '无法开始练习' })
        router.replace('/orgs/' + slug.value + '/bank')
      } finally {
        loading.value = false
      }
    }

    const judge = async (mastered) => {
      const q = current.value
      try {
        await orgAPI.markPractice(slug.value, q.id, mastered)
      } catch { /* 记录失败不阻断 */ }
      if (mastered && !q.mastered) {
        masteredCount.value += 1
        sessionMastered.value += 1
      }
      q.mastered = mastered
      const done = index.value + 1
      if (done >= questions.value.length) {
        finished.value = true
        showToast({ type: 'success', message: '本次练习完成' })
        return
      }
      index.value = done
      revealed.value = false
    }

    onMounted(() => reload(onlyUnmastered.value))
    return {
      title, slug, questions, index, revealed, masteredCount, sessionMastered, finished, loading,
      onlyUnmastered, current, diffLabel, reload, judge
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40px; background: #eef3fb; }
.progress-bar { margin: 12px 16px 0; font-size: 12px; color: rgba(11,22,51,0.55); }
.track { height: 6px; background: #fff; border-radius: 99px; overflow: hidden; margin-top: 6px; }
.track i { display: block; height: 100%; background: linear-gradient(90deg,#2459ff,#52b7ff); }
.card { background: #fff; margin: 12px 16px; padding: 18px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.q-meta { display: flex; gap: 8px; font-size: 12px; color: rgba(11,22,51,0.5); align-items: center; flex-wrap: wrap; }
.tag { background: #f4f7fb; border-radius: 999px; padding: 3px 10px; }
.diff { color: #2459ff; font-weight: 700; }
.ok { color: #16a34a; font-weight: 700; }
.q-content { margin: 12px 0 16px; font-size: 16px; line-height: 1.7; white-space: pre-wrap; color: #0b1633; }
.q-img { width: 100%; border-radius: 12px; margin-bottom: 12px; }
.answer { background: #f9fbff; border-radius: 12px; padding: 12px; font-size: 14px; }
.answer p { margin: 4px 0 10px; white-space: pre-wrap; line-height: 1.65; }
.primary { width: 100%; height: 44px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.primary.slim { width: auto; padding: 0 22px; height: 42px; }
.judge { display: flex; gap: 10px; justify-content: space-between; margin: 0 16px; }
.ghost {
  border: none; background: #fff; color: #e11d48; border-radius: 999px; padding: 0 22px;
  height: 42px; font-weight: 700; border: 1px solid rgba(225,29,72,0.25);
}
.empty { padding: 40px 24px; text-align: center; color: rgba(11,22,51,0.5); font-size: 13px; }
.empty .ghost { margin-top: 16px; color: #2459ff; border-color: rgba(36,89,255,0.28); }
.done { text-align: center; }
.done b { font-size: 18px; }
.done p { margin: 8px 0 14px; font-size: 13px; color: rgba(11,22,51,0.6); }
</style>
