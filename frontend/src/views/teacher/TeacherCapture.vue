<template>
  <div class="page">
    <div class="hero">
      <div class="kicker">CAPTURE</div>
      <h1>拍照识别</h1>
      <p>拍试卷或从相册选图。识别后进入老师题库，不进学生错题本。</p>
    </div>

    <div v-if="!images.length" class="guide">
      <div class="card feature">
        <b>拍照识别</b>
        <span>支持一次多张。跨页题把相邻两页一起上传，会自动合并</span>
      </div>
      <div class="card feature">
        <b>老师题库</b>
        <span>题目只保存在老师账号下，组卷时再发给任意班级</span>
      </div>
      <div class="card feature">
        <b>组卷练习</b>
        <span>到题目页勾选老师题库或学生错题，组成试卷后再发给班级</span>
      </div>
    </div>

    <div v-if="images.length" class="preview">
      <div class="hint">按页序排列 · {{ images.length }}/10 张</div>
      <div class="grid">
        <div v-for="(img, i) in images" :key="img.id" class="item">
          <img :src="img.url" alt="" />
          <button class="x" @click="images.splice(i, 1)">×</button>
          <div class="order">
            <button :disabled="i === 0" @click="move(i, -1)">‹</button>
            <span>第{{ i + 1 }}页</span>
            <button :disabled="i === images.length - 1" @click="move(i, 1)">›</button>
          </div>
        </div>
        <label v-if="images.length < 10" class="item add">
          <span>+</span>
          <span>继续添加</span>
          <input type="file" accept="image/*" multiple hidden @change="onFiles" />
        </label>
      </div>
      <button class="link" @click="images = []">清空重选</button>
    </div>

    <div class="actions">
      <label class="primary">开始拍照 / 选图
        <input type="file" accept="image/*" capture="environment" multiple hidden @change="onFiles" />
      </label>
      <button v-if="images.length" class="primary" :disabled="uploading" @click="submit">
        {{ uploading ? 'AI识别中…' : `开始识别（${images.length} 页）` }}
      </button>
    </div>

    <div v-if="recent.length" class="section-head">最近录入</div>
    <button v-for="item in recent" :key="item.id" class="recent" @click="goBank">
      <span>
        <b>{{ item.title }}</b>
        <i>{{ item.timeText }}</i>
      </span>
      <em>›</em>
    </button>

    <TeacherTabBar />
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import { imageRecognitionAPI } from '../../api/recognition'
import TeacherTabBar from '../../components/TeacherTabBar.vue'

function formatTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return Math.floor(diff / 86400000) + '天前'
}

function buildTitle(q) {
  const category = q.category || '未分类'
  const plain = String(q.content || '').replace(/\s+/g, ' ').trim()
  if (!plain) return category + '题'
  return category + '题 - ' + (plain.length > 22 ? plain.slice(0, 22) + '...' : plain)
}

export default {
  name: 'TeacherCapture',
  components: { TeacherTabBar },
  setup() {
    const router = useRouter()
    const images = ref([])
    const uploading = ref(false)
    const recent = ref([])
    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || e.message || '操作失败' })

    const loadRecent = async () => {
      try {
        const res = await teacherAPI.bank()
        recent.value = (res.data || []).slice(0, 10).map((q) => ({
          id: q.id,
          title: buildTitle(q),
          timeText: formatTime(q.createdAt)
        }))
      } catch { /* ignore */ }
    }

    const onFiles = (e) => {
      const files = Array.from(e.target.files || [])
      e.target.value = ''
      const room = 10 - images.value.length
      files.slice(0, room).forEach((file) => {
        images.value.push({ id: Date.now() + Math.random(), file, url: URL.createObjectURL(file) })
      })
    }
    const move = (i, d) => {
      const j = i + d
      const arr = images.value
      const t = arr[i]
      arr[i] = arr[j]
      arr[j] = t
    }
    const submit = async () => {
      if (!images.value.length) return showToast('请先选图')
      uploading.value = true
      try {
        const res = await imageRecognitionAPI.recognizeImages(images.value.map((x) => ({ file: x.file })))
        const payload = res.data || {}
        const questions = payload.questions || []
        if (!questions.length) throw new Error('没有识别到题目')
        const serverUrls = payload.imageUrls || (payload.imageUrl ? [payload.imageUrl] : [])
        sessionStorage.setItem('teacherBankDraft', JSON.stringify({
          mode: 'teacher_bank',
          tempFilePath: images.value[0]?.url || '',
          fileID: serverUrls[0] || payload.imageUrl || '',
          imageUrl: serverUrls[0] || payload.imageUrl || '',
          fileIDs: serverUrls,
          pages: images.value.map((img, i) => ({
            tempFilePath: img.url,
            fileID: serverUrls[i] || payload.imageUrl || '',
            imageUrl: serverUrls[i] || payload.imageUrl || img.url
          })),
          segments: questions,
          crossPageCount: payload.crossPageCount || 0
        }))
        if (payload.crossPageCount > 0) showToast(`已合并 ${payload.crossPageCount} 道跨页题目`)
        images.value = []
        router.push('/teacher/bank-picker')
      } catch (e) { fail(e) }
      finally { uploading.value = false }
    }
    const goBank = () => router.push({ path: '/teacher/questions', query: { bank: '1' } })

    onMounted(() => loadRecent())
    return { images, uploading, recent, onFiles, move, submit, goBank }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 20px 16px 90px; background: #eef3fb; }
.hero { background: linear-gradient(135deg, #2459ff, #52b7ff); border-radius: 20px; padding: 18px; color: #fff; margin-bottom: 12px; }
.kicker { font-size: 12px; opacity: 0.85; }
.hero h1 { margin: 4px 0 6px; font-size: 22px; }
.hero p { margin: 0; font-size: 13px; opacity: 0.88; }
.guide { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.card.feature { background: #fff; border-radius: 16px; padding: 14px 16px; border: 1px solid rgba(11,22,51,0.06); }
.card.feature b { display: block; color: #0b1633; }
.card.feature span { display: block; margin-top: 4px; font-size: 13px; color: rgba(11,22,51,0.55); }
.preview { margin-bottom: 12px; }
.hint { font-size: 12px; color: rgba(11,22,51,0.5); margin-bottom: 8px; font-weight: 700; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.item { position: relative; background: #fff; border-radius: 14px; overflow: hidden; min-height: 120px; }
.item img { width: 100%; height: 140px; object-fit: cover; display: block; }
.x { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border: none; border-radius: 50%; background: rgba(11,22,51,0.7); color: #fff; }
.order { display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; font-size: 12px; }
.order button { border: none; background: #eef3fb; border-radius: 6px; width: 24px; height: 24px; }
.add { display: flex; flex-direction: column; align-items: center; justify-content: center; color: #2459ff; font-weight: 700; border: 1.5px dashed rgba(36,89,255,0.35); min-height: 160px; }
.link { border: none; background: none; color: #2459ff; margin-top: 10px; font-weight: 700; }
.actions { display: flex; flex-direction: column; gap: 10px; }
.primary { display: block; text-align: center; border: none; border-radius: 999px; height: 44px; line-height: 44px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.section-head { margin: 20px 2px 8px; font-weight: 800; }
.recent { width: 100%; display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid rgba(11,22,51,0.06); border-radius: 16px; padding: 14px 16px; margin-bottom: 8px; text-align: left; }
.recent b { display: block; color: #0b1633; }
.recent i { display: block; margin-top: 4px; font-style: normal; font-size: 12px; color: rgba(11,22,51,0.45); }
.recent em { font-style: normal; color: rgba(11,22,51,0.28); }
</style>
