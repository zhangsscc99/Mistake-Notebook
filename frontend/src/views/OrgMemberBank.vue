<template>
  <div class="page">
    <van-nav-bar :title="title" left-arrow @click-left="goBack" fixed placeholder />
    <div class="search">
      <input v-model="query" type="search" placeholder="搜索题干或科目" />
    </div>
    <div v-if="bank.length" class="toolbar">
      <button class="primary" type="button" @click="startPractice(false)">开始练习</button>
      <button class="ghost" type="button" @click="startPractice(true)">练未掌握</button>
      <button v-if="picked.length" class="ghost" type="button" @click="startPicked">练习选中 {{ picked.length }}</button>
    </div>
    <div v-if="loading" class="empty">加载中…</div>
    <div v-else-if="!visible.length" class="empty">{{ query ? '没有匹配的题目。' : '老师还没有写入专属题目。' }}</div>
    <article v-for="q in visible" :key="q.id" class="card">
      <label class="pick">
        <input type="checkbox" :value="q.id" v-model="picked" />
        <span>{{ q.category || '未分类' }} · {{ diffLabel(q.difficulty) }}</span>
        <em v-if="q.mastered">已掌握</em>
      </label>
      <p>{{ q.content }}</p>
      <img v-if="q.imageUrl" :src="q.imageUrl" alt="" />
      <div class="row">
        <button v-if="q.aiAnswer || q.aiAnalysis" class="text-btn" type="button" @click="toggle(q.id)">
          {{ openId === q.id ? '收起参考' : '查看参考' }}
        </button>
        <button class="text-btn" type="button" @click="practiceOne(q.id)">练这题</button>
      </div>
      <div v-if="openId === q.id" class="ref">
        <p v-if="q.aiAnswer"><b>参考答案</b>{{ q.aiAnswer }}</p>
        <p v-if="q.aiAnalysis"><b>解析</b>{{ q.aiAnalysis }}</p>
      </div>
    </article>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import orgAPI from '../api/org'

export default {
  name: 'OrgMemberBank',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const title = ref('专属题库')
    const bank = ref([])
    const query = ref('')
    const loading = ref(true)
    const openId = ref(null)
    const picked = ref([])
    const goBack = () => {
      const back = window.history.state && window.history.state.back
      if (typeof back === 'string' && back) {
        router.back()
        return
      }
      router.replace('/classroom')
    }
    const diffLabel = (d) => {
      if (d === 'EASY' || d === '简单') return '简单'
      if (d === 'HARD' || d === '困难') return '困难'
      return '中等'
    }
    const visible = computed(() => {
      const q = query.value.trim().toLowerCase()
      if (!q) return bank.value
      return bank.value.filter((item) => {
        const hay = ((item.content || '') + ' ' + (item.category || '')).toLowerCase()
        return hay.includes(q)
      })
    })
    const toggle = (id) => {
      openId.value = openId.value === id ? null : id
    }
    const goPractice = (queryObj) => {
      router.push({ path: '/orgs/' + route.params.slug + '/practice', query: queryObj })
    }
    const startPractice = (unmastered) => {
      if (!bank.value.length) {
        showToast('还没有题目')
        return
      }
      goPractice(unmastered ? { unmastered: '1' } : {})
    }
    const startPicked = () => {
      if (!picked.value.length) return
      goPractice({ ids: picked.value.join(',') })
    }
    const practiceOne = (id) => goPractice({ ids: String(id) })
    onMounted(async () => {
      try {
        const [detail, rows] = await Promise.all([
          orgAPI.detail(route.params.slug).catch(() => ({ data: {} })),
          orgAPI.memberBank(route.params.slug)
        ])
        const name = detail.data?.shortName || detail.data?.name
        if (name) title.value = name + '题库'
        bank.value = rows.data || []
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '无法查看题库' })
        router.replace('/orgs/' + route.params.slug)
      } finally {
        loading.value = false
      }
    })
    return {
      title, query, visible, bank, loading, openId, picked,
      goBack, diffLabel, toggle, startPractice, startPicked, practiceOne
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40px; background: #eef3fb; }
.search { margin: 12px 16px 0; }
.search input {
  width: 100%; height: 44px; border: 1px solid rgba(11,22,51,0.06); border-radius: 14px;
  padding: 0 14px; background: #fff; font-size: 14px;
}
.toolbar { margin: 12px 16px 0; display: flex; flex-wrap: wrap; gap: 8px; }
.primary, .ghost {
  height: 40px; border: none; border-radius: 999px; font-weight: 700; padding: 0 16px;
}
.primary { color: #fff; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.ghost { background: #fff; color: #2459ff; border: 1px solid rgba(36,89,255,0.28); }
.card {
  margin: 12px 16px; padding: 16px; background: #fff; border-radius: 16px;
  border: 1px solid rgba(11,22,51,0.06);
}
.pick { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #2459ff; font-weight: 700; }
.pick em { margin-left: auto; font-style: normal; color: #16a34a; }
.card p { margin: 8px 0 0; font-size: 15px; line-height: 1.6; color: #0b1633; }
.card img { width: 100%; margin-top: 10px; border-radius: 12px; }
.row { display: flex; gap: 16px; margin-top: 10px; }
.text-btn {
  border: none; background: none; color: #2459ff; font-weight: 700; padding: 0;
}
.ref {
  margin-top: 10px; padding: 12px; border-radius: 12px; background: #f4f7fb;
}
.ref p { margin: 0 0 8px; font-size: 13px; color: rgba(11,22,51,0.75); }
.ref p:last-child { margin-bottom: 0; }
.ref b { display: block; color: #0b1633; margin-bottom: 4px; }
.empty { text-align: center; padding: 40px 16px; color: rgba(11,22,51,0.45); font-size: 13px; }
</style>
