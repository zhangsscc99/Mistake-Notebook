<template>
  <div class="page">
    <div class="hero">
      <div class="kicker">PAPER</div>
      <h1>班级组卷</h1>
      <p>先到题目页勾选，带到这里看明细，再发给班级或存成题单。拍照只进题库，不会自动组卷</p>
      <div class="hero-stats">
        <div class="hero-stat"><b>{{ papers.length }}</b><span>题单</span></div>
        <div class="hero-stat"><b>{{ notebooks.length }}</b><span>练习</span></div>
        <div class="hero-stat"><b>{{ assignments.length }}</b><span>作业</span></div>
      </div>
    </div>
    <div class="chips">
      <button v-for="c in classes" :key="c.id" class="chip" :class="{ on: selected.id === c.id }" @click="selectClass(c)">{{ c.name }}</button>
    </div>

    <div class="section-head">
      <span class="section-title">本次组卷{{ pickCount && cartBelongsHere ? ' · ' + pickCount + ' 道' : '' }}</span>
      <span v-if="pickCount && cartBelongsHere" class="note" @click="clearCart">清空</span>
    </div>
    <div v-if="cartLoading" class="empty">加载本次选题…</div>
    <div v-else-if="!cartBelongsHere" class="empty">选题属于其他班级<span>切回那个班可继续组卷，或去当前班重新选题</span></div>
    <div v-else-if="!pickCount" class="empty">还没有选题<span>到题目页勾选学生错题或班级题库，再点「带到组卷」</span></div>
    <div v-for="q in cart" :key="q.id" class="card row">
      <div class="idx">{{ q.index }}</div>
      <div class="grow">
        <b>{{ q.content }}</b>
        <div class="meta"><span class="badge">{{ q.sourceLabel }}</span><span class="badge">{{ q.category }}</span></div>
      </div>
      <button class="link" @click="removeItem(q.id)">移除</button>
    </div>
    <div v-if="cartBelongsHere && pickCount" class="checkout">
      <button class="ghost" @click="savePaper">存为题单</button>
      <button class="primary slim" @click="goSend">发给班级</button>
    </div>
    <div class="links">
      <span @click="goPick">{{ pickCount && cartBelongsHere ? '继续选题' : '去选题' }}</span>
      <span class="dot">·</span>
      <span @click="goCapture">去拍照录入题库</span>
    </div>

    <div class="section-head"><span class="section-title">题单草稿</span></div>
    <div v-for="p in papers" :key="p.id" class="card tap" @click="openSet('paper', p.id)">
      <b>{{ p.title }}</b>
      <span>{{ p.questionCount }} 道题 · {{ fmt(p.createdAt) }} · 学生看不到 · 可再组卷</span>
      <button class="link danger" @click.stop="recall('paper', p)">删除题单</button>
    </div>
    <div v-if="!papers.length" class="empty">还没有题单草稿<span>本次组卷点「存为题单」，之后可打开再发给班级</span></div>

    <div class="section-head"><span class="section-title">已发练习</span></div>
    <div v-for="n in notebooks" :key="n.id" class="card tap" @click="openSet('notebook', n.id)">
      <b>{{ n.title }}</b>
      <span>{{ n.questionCount }} 道题 · {{ fmt(n.createdAt) }} · 学生在「我的班级」可见</span>
      <button class="link danger" @click.stop="recall('notebook', n)">撤回练习</button>
    </div>
    <div v-if="!notebooks.length" class="empty">还没有发给班级的练习<span>本次组卷点「发给班级」，选练习即可</span></div>

    <div class="section-head">
      <span class="section-title">作业</span>
      <span class="note" @click="$router.push('/teacher/homework')">全部批改 ›</span>
    </div>
    <div v-for="a in assignments" :key="a.id" class="card tap" @click="$router.push('/teacher/homework/' + a.id)">
      <b>{{ a.title }}</b>
      <span>{{ a.questionCount }} 道题 · 已交 {{ a.submitted }}/{{ a.studentCount }} · 点开批改</span>
    </div>
    <div v-if="!assignments.length" class="empty">还没有作业<span>发给班级时选「作业」，学生作答后可在这里打分</span></div>

    <van-popup v-model:show="showTitle" round position="center" :style="{ width: '86%', padding: '20px' }">
      <b>题单名称</b>
      <input v-model="paperTitle" class="input" placeholder="例如：周五错题题单" maxlength="30" />
      <div class="popup-actions">
        <button class="ghost" @click="showTitle = false">取消</button>
        <button class="primary slim" @click="confirmPaper">确定</button>
      </div>
    </van-popup>
    <TeacherTabBar />
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import TeacherTabBar from '../../components/TeacherTabBar.vue'
import { partitionPaperQuestions } from '../../utils/questionFormat'
import { fmtDay, getSelectedClassId, pickIds, readPick, setSelectedClassId, shortText, writePick } from '../../utils/teacherClass'

export default {
  name: 'TeacherPaperHub',
  components: { TeacherTabBar },
  setup() {
    const router = useRouter()
    const classes = ref([])
    const selected = ref({})
    const papers = ref([])
    const notebooks = ref([])
    const assignments = ref([])
    const cart = ref([])
    const cartLoading = ref(false)
    const cartBelongsHere = ref(true)
    const showTitle = ref(false)
    const paperTitle = ref('')
    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })
    const fmt = fmtDay
    const pickCount = computed(() => cartBelongsHere.value ? cart.value.length : pickIds().length)

    const loadCart = async () => {
      const pick = readPick()
      const ids = Array.isArray(pick.questionIds) ? pick.questionIds : []
      const classId = selected.value.id || ''
      cartBelongsHere.value = !pick.classId || !classId || Number(pick.classId) === Number(classId)
      if (!ids.length || !cartBelongsHere.value) {
        cart.value = []
        return
      }
      cartLoading.value = true
      try {
        const r = await teacherAPI.picked(ids)
        const { ready, blocked } = partitionPaperQuestions(r.data || [], { teacher: true })
        if (blocked.length) {
          writePick({
            classId: pick.classId || selected.value.id,
            questionIds: ready.map((q) => q.id)
          })
        }
        cart.value = ready.map((q, i) => ({
          ...q,
          index: i + 1,
          content: shortText(q.content, 52),
          category: q.category || '未分类',
          sourceLabel: q.source === 'teacher_bank' ? '题库' : '错题'
        }))
      } catch (e) { fail(e) }
      finally { cartLoading.value = false }
    }

    const reload = async () => {
      const classId = selected.value.id
      if (!classId) return
      const [p, n, a] = await Promise.all([
        teacherAPI.papers(classId),
        teacherAPI.classNotebooks(classId),
        teacherAPI.homework()
      ])
      papers.value = p.data || []
      notebooks.value = n.data || []
      assignments.value = (a.data || []).filter((x) => !classId || x.classId === classId)
    }

    const boot = async () => {
      const res = await teacherAPI.dashboard()
      classes.value = (res.data && res.data.classes) || []
      const pick = readPick()
      const want = Number(pick.classId || getSelectedClassId() || 0)
      selected.value = classes.value.find((c) => c.id === want) || classes.value[0] || {}
      if (selected.value.id) setSelectedClassId(selected.value.id)
      await Promise.all([loadCart(), reload()])
    }

    const selectClass = async (c) => {
      selected.value = c
      setSelectedClassId(c.id)
      await Promise.all([loadCart(), reload()])
    }
    const goPick = () => router.push({ path: '/teacher/questions', query: { pick: 1, classId: selected.value.id } })
    const goCapture = () => {
      if (!selected.value.id) return showToast('请先选择班级')
      router.push({ path: '/teacher/capture', query: { classId: selected.value.id } })
    }
    const removeItem = (id) => {
      const pick = readPick()
      writePick({ classId: pick.classId || selected.value.id, questionIds: (pick.questionIds || []).filter((x) => x !== id) })
      loadCart()
    }
    const clearCart = () => { writePick(null); cart.value = [] }
    const savePaper = () => {
      if (!pickIds().length) return showToast('请先选题')
      paperTitle.value = ''
      showTitle.value = true
    }
    const confirmPaper = async () => {
      if (!paperTitle.value.trim()) return showToast('请填写题单名称')
      const { ready, blocked } = partitionPaperQuestions(cart.value, { teacher: true })
      if (!ready.length) return showToast(blocked.length ? '未解析完成的题目不能加入组卷' : '请先选题')
      try {
        await teacherAPI.savePaper({ classId: selected.value.id, title: paperTitle.value.trim(), questionIds: ready.map((q) => q.id) })
        showTitle.value = false
        showToast({ type: 'success', message: '题单已保存' })
        await reload()
      } catch (e) { fail(e) }
    }
    const goSend = () => {
      if (!selected.value.id) return showToast('请先选择班级')
      if (!pickIds().length) return showToast('请先选题')
      router.push({ path: '/teacher/send', query: { classId: selected.value.id } })
    }
    const openSet = async (type, id) => {
      try {
        const res = type === 'paper' ? await teacherAPI.paper(id) : await teacherAPI.classNotebook(id)
        const d = res.data || {}
        writePick({ classId: d.classId || selected.value.id, questionIds: (d.questions || []).map((q) => q.id).filter(Boolean) })
        await loadCart()
        showToast({ type: 'success', message: '已放入本次组卷' })
      } catch (e) { fail(e) }
    }
    const recall = async (type, item) => {
      const isPaper = type === 'paper'
      try {
        await showConfirmDialog({
          title: isPaper ? '删除题单' : '撤回练习',
          message: isPaper ? '删除后学生本来也看不见。只是从草稿列表拿掉。' : '撤回后学生在「我的班级」将看不到这份练习。',
          confirmButtonText: isPaper ? '删除' : '撤回',
          confirmButtonColor: '#e11d48'
        })
        if (isPaper) await teacherAPI.recallPaper(item.id)
        else await teacherAPI.recallNotebook(item.id)
        showToast({ type: 'success', message: isPaper ? '已删除' : '已撤回' })
        await reload()
      } catch (e) {
        if (e !== 'cancel') fail(e)
      }
    }

    onMounted(() => boot().catch(fail))
    return {
      classes, selected, papers, notebooks, assignments, cart, cartLoading, cartBelongsHere,
      pickCount, showTitle, paperTitle, fmt, selectClass, goPick, goCapture, removeItem, clearCart,
      savePaper, confirmPaper, goSend, openSet, recall
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 20px 16px 90px; background: #eef3fb; }
.hero { background: linear-gradient(135deg, #2459ff, #52b7ff); border-radius: 20px; padding: 18px; color: #fff; margin-bottom: 12px; }
.kicker { font-size: 12px; opacity: 0.85; }
.hero h1 { margin: 4px 0 6px; font-size: 22px; }
.hero p { margin: 0; font-size: 13px; opacity: 0.88; }
.hero-stats { margin-top: 14px; display: flex; background: rgba(255,255,255,0.18); border-radius: 14px; }
.hero-stat { flex: 1; text-align: center; padding: 10px 0; }
.hero-stat b { display: block; font-size: 18px; }
.hero-stat span { font-size: 11px; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.chip { border: none; background: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 700; }
.chip.on { background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; }
.section-head { display: flex; justify-content: space-between; margin: 16px 2px 8px; }
.section-title { font-weight: 800; }
.note { font-size: 12px; color: #2459ff; }
.card { background: #fff; border-radius: 16px; padding: 14px; margin-bottom: 8px; border: 1px solid rgba(11,22,51,0.06); }
.card.tap, .card.row { display: flex; gap: 10px; }
.card.tap { flex-direction: column; cursor: pointer; }
.card.tap span, .card b + span { font-size: 12px; color: rgba(11,22,51,0.5); margin-top: 4px; }
.idx { width: 24px; height: 24px; border-radius: 8px; background: #2459ff; color: #fff; text-align: center; line-height: 24px; font-size: 12px; font-weight: 800; flex-shrink: 0; }
.grow { flex: 1; min-width: 0; }
.meta { display: flex; gap: 6px; margin-top: 6px; }
.badge { font-size: 11px; background: #f4f7fb; border-radius: 999px; padding: 2px 8px; color: rgba(11,22,51,0.55); }
.link { border: none; background: none; color: #e11d48; font-weight: 700; }
.checkout { display: flex; gap: 8px; margin: 8px 0 4px; }
.links { font-size: 13px; color: #2459ff; font-weight: 700; margin: 8px 2px 4px; }
.dot { margin: 0 6px; color: rgba(11,22,51,0.3); }
.ghost { border: none; background: #eef3fb; color: #2459ff; border-radius: 999px; padding: 10px 16px; font-weight: 700; }
.primary.slim { border: none; border-radius: 999px; padding: 0 18px; height: 40px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); margin-left: auto; }
.empty { text-align: center; padding: 18px 8px; color: rgba(11,22,51,0.45); font-size: 13px; }
.empty span { display: block; margin-top: 6px; font-size: 12px; }
.input { width: 100%; height: 42px; border: none; background: #f4f7fb; border-radius: 12px; padding: 0 12px; margin-top: 12px; }
.popup-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
</style>
