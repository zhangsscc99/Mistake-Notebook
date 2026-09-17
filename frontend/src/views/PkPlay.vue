<template>
  <div class="page">
    <van-nav-bar title="答题 PK" left-arrow @click-left="$router.push('/community/pk')" />

    <div v-if="card.id" class="card vs">
      <div>
        <b>{{ card.challenger?.nickName }}</b>
        <span>发起</span>
      </div>
      <em>{{ scoreText }}</em>
      <div>
        <b>{{ card.opponent?.nickName }}</b>
        <span>应战</span>
      </div>
    </div>
    <p class="status">{{ card.result }} · {{ modeText }}</p>

    <div v-if="card.status === 'PENDING'" class="card">
      <p v-if="card.incoming">对方用错题本抽了 {{ play.questionCount || card.questionCount || 0 }} 道题。应战后开始作答。</p>
      <p v-else>等待对方应战。应战后双方各自作答，先交卷的人等对方。</p>
      <button v-if="card.incoming" class="primary" :disabled="acting" @click="accept">{{ acting ? '进入中…' : '应战并开始答题' }}</button>
    </div>

    <div v-if="play.canSubmit" class="quiz">
      <article v-for="(q, i) in play.questions || []" :key="q.id" class="card">
        <div class="q-head">第 {{ i + 1 }} 题 · {{ q.category || '错题' }}</div>
        <p class="stem">{{ q.content }}</p>
        <textarea v-model="answers[q.id]" maxlength="400" placeholder="写下你的答案或关键步骤"></textarea>
      </article>
      <button class="primary bottom" :disabled="sending" @click="submit">{{ sending ? '交卷中…' : '交卷' }}</button>
    </div>

    <div v-else-if="card.status !== 'PENDING' && (play.questions || []).length">
      <article v-for="(q, i) in play.questions" :key="q.id" class="card">
        <div class="q-head">第 {{ i + 1 }} 题 · {{ q.category || '错题' }}</div>
        <p class="stem">{{ q.content }}</p>
        <p v-if="play.submitted" class="mine" :class="{ ok: q.myCorrect, bad: q.myCorrect === false }">
          我的作答：{{ q.myAnswer || '（空）' }}
        </p>
        <p v-if="card.status === 'DONE'" class="ans">参考：{{ q.answer || '本题暂无标准答案' }}</p>
        <p v-if="card.status === 'DONE'" class="mine">对方：{{ q.opponentAnswer || '（空）' }}</p>
      </article>
      <p v-if="play.submitted && card.status === 'ACTIVE'" class="empty">已交卷，等待对方。</p>
    </div>

    <div v-if="card.mode === 'POWER' && card.status === 'DONE'" class="card">
      <p>双方错题本里还抽不出题目，所以按打卡、错题量和掌握度结算战力。</p>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import socialAPI from '../api/social'

export default {
  name: 'PkPlay',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const card = ref({})
    const play = ref({})
    const answers = reactive({})
    const sending = ref(false)
    const acting = ref(false)

    const apply = (d) => {
      card.value = d || {}
      play.value = d?.play || {}
      ;(play.value.questions || []).forEach((q) => {
        if (answers[q.id] == null) answers[q.id] = q.myAnswer || ''
      })
    }

    const load = async () => {
      try {
        const res = await socialAPI.pkDetail(route.params.id)
        apply(res.data || {})
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '对战不存在' })
        router.replace('/community/pk')
      }
    }

    const accept = async () => {
      acting.value = true
      try {
        const res = await socialAPI.acceptPk(route.params.id)
        apply(res.data || {})
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '应战失败' })
      } finally {
        acting.value = false
      }
    }

    const submit = async () => {
      sending.value = true
      try {
        const payload = {}
        Object.keys(answers).forEach((k) => { payload[k] = answers[k] })
        const res = await socialAPI.submitPk(route.params.id, payload)
        apply(res.data || {})
        showToast({ type: 'success', message: res.data?.result || '已交卷' })
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '交卷失败' })
      } finally {
        sending.value = false
      }
    }

    const scoreText = computed(() => {
      if (card.value.status === 'DONE') return (card.value.challengerScore || 0) + ' : ' + (card.value.opponentScore || 0)
      return 'VS'
    })
    const modeText = computed(() => card.value.mode === 'QUIZ' ? '错题答题' : '战力对决')

    onMounted(load)
    return { card, play, answers, sending, acting, accept, submit, scoreText, modeText }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 80px; background: #eef3fb; }
.card {
  background: #fff; margin: 12px 16px; padding: 14px; border-radius: 16px;
  border: 1px solid rgba(11,22,51,0.06);
}
.vs { display: flex; justify-content: space-between; align-items: center; text-align: center; }
.vs b { display: block; color: #0b1633; }
.vs span { font-size: 12px; color: rgba(11,22,51,0.45); }
.vs em { font-style: normal; color: #2459ff; font-weight: 800; }
.status { text-align: center; font-size: 13px; color: rgba(11,22,51,0.55); }
.q-head { font-size: 12px; color: #2459ff; font-weight: 700; }
.stem { margin: 8px 0; line-height: 1.7; color: #0b1633; white-space: pre-wrap; }
textarea {
  width: 100%; min-height: 72px; border: none; background: #f4f7fb; border-radius: 12px;
  padding: 10px 12px; resize: none;
}
.mine { margin: 8px 0 0; font-size: 13px; color: rgba(11,22,51,0.7); }
.mine.ok { color: #0f7b4c; }
.mine.bad { color: #c2410c; }
.ans { margin: 8px 0 0; padding: 8px 10px; background: #f4f7fb; border-radius: 10px; font-size: 13px; }
.primary {
  width: 100%; height: 42px; border: none; border-radius: 999px; color: #fff; font-weight: 700;
  background: linear-gradient(135deg, #2459ff, #52b7ff);
}
.primary.bottom { margin: 8px 16px 0; width: calc(100% - 32px); }
.primary:disabled { opacity: 0.45; }
.empty { text-align: center; color: rgba(11,22,51,0.45); padding: 8px 16px; }
</style>
