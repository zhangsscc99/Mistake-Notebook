<template>
  <div class="page" :class="{ picking }">
    <div class="hero">
      <div class="kicker">QUESTIONS</div>
      <h1>全班题目</h1>
      <p>学生错题和班级题库都在这里。拍照录入进题库，不进学生错题</p>
      <div class="hero-stats">
        <div class="hero-stat" @click="sourceFilter = 'mistakes'"><b>{{ stats.total || 0 }}</b><span>错题</span></div>
        <div class="hero-stat"><b>{{ stats.studentCount || 0 }}</b><span>学生</span></div>
        <div class="hero-stat" @click="sourceFilter = 'bank'"><b>{{ bank.length }}</b><span>题库</span></div>
      </div>
      <button class="ghost-hero" @click="goCapture">拍照录入</button>
    </div>

    <div class="chips">
      <button v-for="c in classes" :key="c.id" class="chip" :class="{ on: selected.id === c.id }" @click="selectClass(c)">{{ c.name }}</button>
    </div>
    <div class="chips">
      <button class="chip" :class="{ on: sourceFilter === 'mistakes' }" @click="sourceFilter = 'mistakes'">学生错题</button>
      <button class="chip" :class="{ on: sourceFilter === 'bank' }" @click="sourceFilter = 'bank'">班级题库</button>
    </div>
    <div class="search">
      <input v-model="keyword" placeholder="搜索题干" />
      <button v-if="keyword" class="clear" @click="keyword = ''">清除</button>
    </div>
    <div class="chips scroll">
      <button v-for="c in categoryChips" :key="c.value" class="chip" :class="{ on: category === c.value }" @click="category = c.value">{{ c.name }} {{ c.count }}</button>
    </div>
    <div v-if="sourceFilter === 'mistakes' && students.length" class="chips scroll">
      <button class="chip" :class="{ on: !studentId }" @click="studentId = 0">全班</button>
      <button v-for="s in students" :key="s.id" class="chip" :class="{ on: studentId === s.id }" @click="studentId = s.id">{{ s.nickName || s.name }} {{ s.questionCount }}</button>
    </div>
    <div class="chips">
      <button v-if="sourceFilter === 'mistakes'" class="chip" :class="{ on: onlyHot }" @click="onlyHot = !onlyHot">只看高频</button>
      <button v-if="!picking" class="chip" @click="picking = true">选题</button>
      <button v-if="picking" class="chip" @click="toggleVisible">{{ visibleAllSelected ? '取消当前' : '全选当前' }}</button>
    </div>

    <div class="section-head">
      <span class="section-title">题目</span>
      <span class="note">显示 {{ visible.length }} 道<span v-if="selectedCount"> · 已选 {{ selectedCount }}</span></span>
    </div>
    <div v-for="q in visible" :key="q.id" class="card" @click="onTap(q)">
      <div class="row">
        <div v-if="picking" class="check" :class="{ on: selectedMap[q.id] }">{{ selectedMap[q.id] ? '✓' : '' }}</div>
        <div v-if="q.isHot" class="hot">{{ q.hotCount }}次</div>
        <div class="grow">
          <div class="content">{{ q.content }}</div>
          <div class="meta">
            <span class="badge">{{ q.category || '未分类' }}</span>
            <span class="badge">{{ q.nickName || '学生' }}</span>
            <span v-if="q.isHot" class="badge">高频</span>
            <span v-if="sourceFilter === 'bank'" class="badge">题库</span>
          </div>
        </div>
      </div>
    </div>
    <div v-if="!loading && !visible.length && sourceFilter === 'bank'" class="empty">还没有老师录入的题<span>点上方「拍照录入」，识别后会进这个班的题库</span></div>
    <div v-if="!loading && !visible.length && sourceFilter !== 'bank'" class="empty">没有符合条件的学生错题<span>换个分类、学生或搜索词试试</span></div>

    <div v-if="picking" class="dock">
      <div>已选 {{ selectedCount }} 道 · 当前显示 {{ visible.length }} 道</div>
      <div class="dock-actions">
        <button class="ghost" @click="cancelPick">取消</button>
        <button class="primary slim" @click="confirmPick">带到组卷</button>
      </div>
    </div>

    <TeacherTabBar />
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import TeacherTabBar from '../../components/TeacherTabBar.vue'
import { getSelectedClassId, setSelectedClassId, readPick, writePick } from '../../utils/teacherClass'
import { partitionPaperQuestions } from '../../utils/questionFormat'

export default {
  name: 'TeacherQuestions',
  components: { TeacherTabBar },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const classes = ref([])
    const selected = ref({})
    const mistakes = ref([])
    const bank = ref([])
    const students = ref([])
    const stats = ref({})
    const sourceFilter = ref('mistakes')
    const keyword = ref('')
    const category = ref('')
    const studentId = ref(0)
    const onlyHot = ref(false)
    const picking = ref(route.query.pick === '1')
    const selectedMap = reactive({})
    const loading = ref(false)
    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })

    const hotIndex = computed(() => {
      const map = {}
      for (const q of mistakes.value) {
        const key = String(q.content || '').replace(/\s+/g, '').toLowerCase()
        if (!map[key]) map[key] = { count: 0 }
        map[key].count += 1
      }
      return map
    })

    const decoratedMistakes = computed(() => mistakes.value.map((q) => {
      const key = String(q.content || '').replace(/\s+/g, '').toLowerCase()
      const hotCount = hotIndex.value[key]?.count || 1
      return { ...q, hotCount, isHot: hotCount >= 2 }
    }))

    const pool = computed(() => sourceFilter.value === 'bank' ? bank.value : decoratedMistakes.value)

    const categoryChips = computed(() => {
      const counts = {}
      for (const q of pool.value) {
        const name = q.category || '未分类'
        counts[name] = (counts[name] || 0) + 1
      }
      const chips = Object.keys(counts).map((name) => ({ name, value: name, count: counts[name] }))
      chips.sort((a, b) => b.count - a.count)
      return [{ name: '全部', value: '', count: pool.value.length }, ...chips]
    })

    const visible = computed(() => {
      const kw = keyword.value.trim().toLowerCase()
      return pool.value.filter((q) => {
        if (category.value && (q.category || '未分类') !== category.value) return false
        if (sourceFilter.value === 'mistakes' && studentId.value && q.userId !== studentId.value) return false
        if (onlyHot.value && sourceFilter.value === 'mistakes' && !q.isHot) return false
        if (kw && !String(q.content || '').toLowerCase().includes(kw)) return false
        return true
      })
    })

    const selectedCount = computed(() => Object.keys(selectedMap).filter((k) => selectedMap[k]).length)
    const visibleAllSelected = computed(() => visible.value.length > 0 && visible.value.every((q) => selectedMap[q.id]))

    const loadClass = async (cls) => {
      if (!cls?.id) return
      loading.value = true
      selected.value = cls
      setSelectedClassId(cls.id)
      try {
        const [q, b, st, stu] = await Promise.all([
          teacherAPI.classQuestions(cls.id),
          teacherAPI.bank(cls.id),
          teacherAPI.classStats(cls.id),
          teacherAPI.classStudents(cls.id)
        ])
        mistakes.value = (q.data && q.data.questions) || []
        bank.value = b.data || []
        stats.value = st.data || {}
        students.value = (stu.data || []).map((s) => ({ ...s, name: s.nickName }))
      } catch (e) { fail(e) }
      finally { loading.value = false }
    }

    const boot = async () => {
      const res = await teacherAPI.dashboard()
      classes.value = (res.data && res.data.classes) || []
      const want = Number(route.query.classId || getSelectedClassId() || 0)
      const cls = classes.value.find((c) => c.id === want) || classes.value[0]
      if (cls) await loadClass(cls)
      const pick = readPick()
      ;(pick.questionIds || []).forEach((id) => { selectedMap[id] = true })
    }

    const selectClass = (c) => loadClass(c)
    const goCapture = () => {
      if (!selected.value.id) return showToast('请先选择班级')
      router.push({ path: '/teacher/capture', query: { classId: selected.value.id } })
    }
    const onTap = (q) => {
      if (!picking.value) return
      selectedMap[q.id] = !selectedMap[q.id]
    }
    const toggleVisible = () => {
      const on = !visibleAllSelected.value
      visible.value.forEach((q) => { selectedMap[q.id] = on })
    }
    const cancelPick = () => { picking.value = false }
    const confirmPick = () => {
      const pool = [...mistakes.value, ...bank.value]
      const picked = pool.filter((q) => selectedMap[q.id])
      const { ready, blocked } = partitionPaperQuestions(picked, { teacher: true })
      if (!ready.length) {
        showToast(blocked.length ? '未解析完成的题目不能加入组卷' : '请先选题')
        return
      }
      if (blocked.length) {
        showToast(`已跳过 ${blocked.length} 道未解析完成的题`)
      }
      writePick({ classId: selected.value.id, questionIds: ready.map((q) => q.id) })
      router.push('/teacher/paper')
    }

    watch(sourceFilter, () => { category.value = ''; studentId.value = 0; onlyHot.value = false })
    onMounted(() => boot().catch(fail))
    return {
      classes, selected, bank, students, stats, sourceFilter, keyword, category, studentId, onlyHot,
      picking, selectedMap, loading, categoryChips, visible, selectedCount, visibleAllSelected,
      selectClass, goCapture, onTap, toggleVisible, cancelPick, confirmPick
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 20px 16px 120px; background: #eef3fb; }
.hero { background: linear-gradient(135deg, #2459ff, #52b7ff); border-radius: 20px; padding: 18px; color: #fff; margin-bottom: 12px; }
.kicker { font-size: 12px; opacity: 0.85; }
.hero h1 { margin: 4px 0 6px; font-size: 22px; }
.hero p { margin: 0; font-size: 13px; opacity: 0.88; }
.hero-stats { margin-top: 14px; display: flex; background: rgba(255,255,255,0.18); border-radius: 14px; }
.hero-stat { flex: 1; text-align: center; padding: 10px 0; }
.hero-stat b { display: block; font-size: 18px; }
.hero-stat span { font-size: 11px; opacity: 0.85; }
.ghost-hero { margin-top: 12px; border: none; background: rgba(255,255,255,0.22); color: #fff; border-radius: 999px; padding: 8px 14px; font-weight: 700; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.chips.scroll { flex-wrap: nowrap; overflow-x: auto; }
.chip { border: none; background: #fff; color: #0b1633; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.chip.on { background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; box-shadow: 0 6px 16px rgba(31,91,255,0.28); }
.search { display: flex; background: #fff; border-radius: 12px; padding: 0 12px; margin-bottom: 8px; border: 1px solid rgba(11,22,51,0.06); }
.search input { flex: 1; height: 40px; border: none; background: transparent; }
.clear { border: none; background: none; color: #2459ff; font-weight: 700; }
.section-head { display: flex; justify-content: space-between; margin: 12px 2px 8px; }
.section-title { font-weight: 800; }
.note { font-size: 12px; color: rgba(11,22,51,0.45); }
.card { background: #fff; border-radius: 16px; padding: 14px; margin-bottom: 8px; border: 1px solid rgba(11,22,51,0.06); }
.row { display: flex; gap: 10px; align-items: flex-start; }
.check { width: 22px; height: 22px; border-radius: 6px; border: 1.5px solid rgba(36,89,255,0.4); text-align: center; line-height: 20px; font-size: 12px; color: #fff; flex-shrink: 0; }
.check.on { background: #2459ff; border-color: #2459ff; }
.hot { font-size: 11px; color: #e11d48; font-weight: 800; flex-shrink: 0; }
.grow { flex: 1; min-width: 0; }
.content { font-size: 14px; line-height: 1.55; color: #0b1633; }
.meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.badge { font-size: 11px; background: #f4f7fb; color: rgba(11,22,51,0.55); border-radius: 999px; padding: 2px 8px; }
.empty { text-align: center; padding: 24px 8px; color: rgba(11,22,51,0.45); font-size: 13px; }
.empty span { display: block; margin-top: 6px; font-size: 12px; }
.dock { position: fixed; left: 12px; right: 12px; bottom: 72px; background: #fff; border-radius: 16px; padding: 12px 14px; box-shadow: 0 12px 36px rgba(11,22,51,0.12); z-index: 20; font-size: 13px; }
.dock-actions { display: flex; gap: 8px; margin-top: 10px; }
.ghost { border: none; background: #eef3fb; color: #2459ff; border-radius: 999px; padding: 8px 14px; font-weight: 700; }
.primary.slim { border: none; margin-left: auto; border-radius: 999px; padding: 0 18px; height: 36px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
</style>
