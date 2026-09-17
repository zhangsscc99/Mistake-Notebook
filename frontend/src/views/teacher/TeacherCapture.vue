<template>
  <div class="page">
    <van-nav-bar title="拍照录入" left-arrow @click-left="$router.back()" fixed placeholder />
    <div class="hero">
      <div class="kicker">CAPTURE</div>
      <h1>拍照录入</h1>
      <p>拍试卷或从相册选图，识别后存进这个班的题库。不会进入个人错题本</p>
    </div>
    <div class="section-head"><span class="section-title">班级</span></div>
    <div class="chips">
      <button v-for="c in classes" :key="c.id" class="chip" :class="{ on: selected.id === c.id }" @click="selected = c">{{ c.name }}</button>
    </div>
    <div v-if="!classes.length" class="empty">还没有班级<span>先去「班级」新建</span></div>

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
        {{ uploading ? 'AI识别中…' : `识别并写入题库（${images.length} 页）` }}
      </button>
    </div>
    <div v-if="resultCount != null" class="ok">已写入题库 {{ resultCount }} 道</div>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import { imageRecognitionAPI } from '../../api/recognition'
import { getSelectedClassId, setSelectedClassId } from '../../utils/teacherClass'

export default {
  name: 'TeacherCapture',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const classes = ref([])
    const selected = ref({})
    const images = ref([])
    const uploading = ref(false)
    const resultCount = ref(null)
    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || e.message || '操作失败' })

    const boot = async () => {
      const res = await teacherAPI.dashboard()
      classes.value = (res.data && res.data.classes) || []
      const want = Number(route.query.classId || getSelectedClassId() || 0)
      selected.value = classes.value.find((c) => c.id === want) || classes.value[0] || {}
      if (selected.value.id) setSelectedClassId(selected.value.id)
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
      if (!selected.value.id) return showToast('请先选择班级')
      if (!images.value.length) return showToast('请先选图')
      uploading.value = true
      resultCount.value = null
      try {
        const res = await imageRecognitionAPI.recognizeImages(images.value.map((x) => ({ file: x.file })))
        const questions = (res.data && res.data.questions) || []
        if (!questions.length) throw new Error('没有识别到题目')
        const saved = await teacherAPI.saveBank({
          classId: selected.value.id,
          questions,
          category: questions[0].subject || '未分类'
        })
        resultCount.value = saved.data?.savedCount || questions.length
        showToast({ type: 'success', message: `已写入题库 ${resultCount.value} 道` })
        setTimeout(() => router.replace({ path: '/teacher/questions', query: { classId: selected.value.id } }), 600)
      } catch (e) { fail(e) }
      finally { uploading.value = false }
    }

    onMounted(() => boot().catch(fail))
    return { classes, selected, images, uploading, resultCount, onFiles, move, submit }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 32px; background: #eef3fb; }
.hero { margin: 12px 16px; background: linear-gradient(135deg, #2459ff, #52b7ff); border-radius: 20px; padding: 18px; color: #fff; }
.kicker { font-size: 12px; opacity: 0.85; }
.hero h1 { margin: 4px 0 6px; font-size: 22px; }
.hero p { margin: 0; font-size: 13px; opacity: 0.88; }
.section-head { margin: 8px 16px; font-weight: 800; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 16px; }
.chip { border: none; background: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 700; }
.chip.on { background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; }
.preview { margin: 16px; }
.hint { font-size: 12px; color: rgba(11,22,51,0.5); margin-bottom: 8px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.item { position: relative; background: #fff; border-radius: 14px; overflow: hidden; min-height: 120px; }
.item img { width: 100%; height: 140px; object-fit: cover; display: block; }
.x { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border: none; border-radius: 50%; background: rgba(11,22,51,0.7); color: #fff; }
.order { display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; font-size: 12px; }
.order button { border: none; background: #eef3fb; border-radius: 6px; width: 24px; height: 24px; }
.add { display: flex; flex-direction: column; align-items: center; justify-content: center; color: #2459ff; font-weight: 700; border: 1.5px dashed rgba(36,89,255,0.35); min-height: 160px; }
.link { border: none; background: none; color: #2459ff; margin-top: 10px; font-weight: 700; }
.actions { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.primary { display: block; text-align: center; border: none; border-radius: 999px; height: 44px; line-height: 44px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.empty { text-align: center; padding: 24px; color: rgba(11,22,51,0.45); }
.empty span { display: block; margin-top: 6px; font-size: 12px; }
.ok { text-align: center; color: #16a34a; font-weight: 700; }
</style>
