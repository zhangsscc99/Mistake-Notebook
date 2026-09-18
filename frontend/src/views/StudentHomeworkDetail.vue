<template>
  <div class="page">
    <van-nav-bar :title="hw.title || '作业'" left-arrow @click-left="$router.back()" fixed placeholder />

    <div class="card">
      <p v-if="hw.description" class="desc">{{ hw.description }}</p>
      <div class="meta">
        {{ hw.questionCount }} 题
        <span v-if="hw.dueAt"> · 截止 {{ fmt(hw.dueAt) }}</span>
      </div>
      <div v-if="graded" class="score-box">
        <b>{{ sub.score ?? 0 }}</b> 分
        <p v-if="sub.feedback">老师点评：{{ sub.feedback }}</p>
      </div>
    </div>

    <div v-for="(q, i) in hw.questions || []" :key="i" class="card">
      <div class="q-head">
        <span class="idx">{{ i + 1 }}</span>
        <span class="score-tag">{{ q.score || 10 }} 分</span>
        <span v-if="graded && sub.marks?.length" class="got">{{ markText(i) }}</span>
      </div>
      <p class="q-content">{{ q.content }}</p>
      <textarea
        v-if="!submitted"
        v-model="answers[i]"
        class="answer-input"
        placeholder="写下你的答案或解题过程，也可以只上传图片"
      ></textarea>
      <div v-else class="answer-done">
        <b>你的作答</b>
        <p>{{ answers[i] || (answerImages[i] ? '' : '（未作答）') }}</p>
        <template v-if="graded && q.answer">
          <b>参考答案</b>
          <p>{{ q.answer }}</p>
        </template>
      </div>
      <div v-if="answerImages[i]" class="ans-img">
        <img :src="absUrl(answerImages[i])" alt="作答图片" @click="preview(answerImages[i])" />
        <button v-if="!submitted" type="button" class="img-remove" @click="answerImages[i] = ''">删除图片</button>
        <span v-else class="img-preview" @click="preview(answerImages[i])">查看原图</span>
      </div>
      <div v-if="!submitted" class="pick-row">
        <label class="pick">拍照
          <input type="file" accept="image/*" capture="environment" hidden @change="onPick($event, i)" />
        </label>
        <label class="pick">相册
          <input type="file" accept="image/*" hidden @change="onPick($event, i)" />
        </label>
        <span class="pick-hint" v-if="uploading === i">正在上传…</span>
        <span class="pick-hint" v-else-if="answerImages[i]">可换一张</span>
      </div>
    </div>

    <div v-if="!submitted" class="footer">
      <button class="primary" :disabled="saving || uploading >= 0" @click="submit">{{ saving ? '提交中…' : '提交作业' }}</button>
    </div>
    <p v-else class="tip">{{ graded ? '老师已批改。' : '已提交，等待老师批改。' }}</p>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showImagePreview, showToast } from 'vant'
import classroomAPI from '../api/classroom'
import { API_BASE_URL, uploadClient } from '../api/config'

export default {
  name: 'StudentHomeworkDetail',
  setup() {
    const route = useRoute()
    const hw = ref({})
    const sub = ref({})
    const answers = ref([])
    const answerImages = ref([])
    const saving = ref(false)
    const uploading = ref(-1)

    const submitted = computed(() => !!sub.value.status)
    const graded = computed(() => sub.value.status === 'GRADED')

    const plain = (v) => (v && typeof v === 'object' ? String(v.text ?? v.value ?? v.answer ?? '') : String(v ?? ''))
    const imageOf = (v) => (v && typeof v === 'object' ? String(v.image || v.url || '') : '')
    const absUrl = (url) => {
      if (!url) return ''
      if (/^(https?:|blob:|data:)/i.test(url)) return url
      return API_BASE_URL.replace(/\/$/, '') + url
    }

    const load = async () => {
      const res = await classroomAPI.homeworkDetail(route.params.id)
      const d = res.data || {}
      hw.value = d
      sub.value = d.submission || {}
      const count = (d.questions || []).length
      const existing = sub.value.answers || []
      const images = sub.value.answerImages || []
      answers.value = Array.from({ length: count }, (_, i) => plain(existing[i]))
      answerImages.value = Array.from({ length: count }, (_, i) => String(images[i] || imageOf(existing[i]) || ''))
    }

    const itemScore = (i) => {
      const v = (sub.value.itemScores || [])[i]
      if (v == null) return 0
      return typeof v === 'object' ? (v.value ?? 0) : v
    }
    const markText = (i) => {
      const m = (sub.value.marks || [])[i]
      if (m === 'right' || m === '对') return '对'
      if (m === 'wrong' || m === '错') return '错'
      return '得 ' + itemScore(i) + ' 分'
    }

    const preview = (url) => {
      const src = absUrl(url)
      if (!src) return
      showImagePreview({ images: [src] })
    }

    const onPick = async (e, i) => {
      const file = e.target.files && e.target.files[0]
      e.target.value = ''
      if (!file) return
      uploading.value = i
      try {
        const fd = new FormData()
        fd.append('file', file)
        const up = await uploadClient.post('/upload/file', fd)
        const url = up.data?.data?.url || up.data?.url
        if (!url) throw new Error('上传失败')
        const next = answerImages.value.slice()
        next[i] = absUrl(url)
        answerImages.value = next
      } catch (err) {
        showToast({ type: 'fail', message: err.response?.data?.message || err.message || '上传失败' })
      } finally {
        uploading.value = -1
      }
    }

    const submit = async () => {
      if (uploading.value >= 0) return showToast('图片还在上传')
      saving.value = true
      try {
        await classroomAPI.submitHomework(route.params.id, answers.value, answerImages.value)
        await load()
        showToast({ type: 'success', message: '已提交' })
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '提交失败' })
      } finally {
        saving.value = false
      }
    }

    const fmt = (t) => (t ? String(t).replace('T', ' ').slice(0, 16) : '')
    onMounted(() => load().catch((e) => showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })))
    return {
      hw, sub, answers, answerImages, saving, uploading, submitted, graded,
      itemScore, markText, submit, fmt, absUrl, preview, onPick
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 100px; background: #eef3fb; }
.card { background: #fff; margin: 12px 16px; padding: 16px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.desc { margin: 0 0 8px; font-size: 13px; color: rgba(11,22,51,0.6); }
.meta { font-size: 12px; color: rgba(11,22,51,0.5); }
.score-box { margin-top: 12px; background: rgba(36,89,255,0.08); border-radius: 12px; padding: 12px; }
.score-box b { font-size: 24px; color: #2459ff; }
.score-box p { margin: 6px 0 0; font-size: 13px; color: rgba(11,22,51,0.7); }
.q-head { display: flex; align-items: center; gap: 8px; }
.idx { width: 22px; height: 22px; border-radius: 7px; background: #2459ff; color: #fff; font-size: 12px; text-align: center; line-height: 22px; font-weight: 700; }
.score-tag { font-size: 12px; color: rgba(11,22,51,0.5); }
.got { margin-left: auto; font-size: 12px; font-weight: 700; color: #16a34a; }
.q-content { margin: 10px 0; font-size: 14px; line-height: 1.65; white-space: pre-wrap; }
.answer-input { width: 100%; height: 90px; border: none; background: #f4f7fb; border-radius: 12px; padding: 10px; resize: none; font-size: 14px; }
.answer-done { background: #f9fbff; border-radius: 12px; padding: 12px; font-size: 13px; }
.answer-done p { margin: 4px 0 10px; white-space: pre-wrap; line-height: 1.6; }
.ans-img { position: relative; height: 150px; margin-top: 10px; overflow: hidden; border-radius: 12px; background: rgba(36,89,255,0.08); }
.ans-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.img-remove, .img-preview {
  position: absolute; bottom: 8px; padding: 4px 10px; border: none; border-radius: 999px;
  color: #fff; font-size: 11px; font-weight: 700;
}
.img-remove { left: 8px; background: rgba(225,29,72,0.78); }
.img-preview { right: 8px; background: rgba(11,22,51,0.55); }
.pick-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.pick {
  height: 32px; padding: 0 14px; line-height: 32px; border-radius: 999px;
  color: #2459ff; font-size: 13px; font-weight: 800; background: #fff;
  box-shadow: inset 0 0 0 1px rgba(36,89,255,0.30);
}
.pick-hint { font-size: 12px; color: rgba(11,22,51,0.45); }
.footer { position: fixed; left: 0; right: 0; bottom: 0; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid rgba(11,22,51,0.06); }
.primary { width: 100%; height: 44px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.tip { text-align: center; font-size: 13px; color: rgba(11,22,51,0.5); padding: 8px 16px 24px; }
</style>
