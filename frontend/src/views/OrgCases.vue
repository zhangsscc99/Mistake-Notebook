<template>
  <div class="page">
    <van-nav-bar title="机构版" left-arrow @click-left="goBack" fixed placeholder />
    <div class="intro">
      <div class="kicker">INSTITUTION</div>
      <h1>机构目录</h1>
      <p>老师开通并公开后，会出现在这里。</p>
    </div>
    <div class="search">
      <input v-model="query" type="search" placeholder="搜索机构名称、城市或介绍" @keyup.enter="load" />
    </div>
    <article v-for="org in orgs" :key="org.slug" class="card" @click="$router.push('/orgs/' + org.slug)">
      <img v-if="org.logoUrl" class="logo" :src="org.logoUrl" alt="" />
      <div v-else class="mark" :style="{ background: org.theme?.primary }">{{ org.mark }}</div>
      <div class="body">
        <div class="city">{{ org.city || '未填城市' }} · {{ org.studentCount || 0 }} 人{{ org.demo ? ' · 示例' : '' }}</div>
        <h2>{{ org.name }}</h2>
        <p>{{ org.tagline }}</p>
      </div>
    </article>
    <p v-if="loaded && !orgs.length" class="empty">没有找到匹配的机构。</p>
  </div>
</template>

<script>
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import orgAPI from '../api/org'
import { isLoggedIn, isTeacher } from '../utils/auth'

export default {
  name: 'OrgCases',
  setup() {
    const router = useRouter()
    const orgs = ref([])
    const query = ref('')
    const loaded = ref(false)
    let timer = null
    const fallback = () => {
      if (isLoggedIn() && isTeacher()) return '/teacher/mine'
      if (isLoggedIn()) return '/profile'
      return '/login'
    }
    const goBack = () => {
      const back = window.history.state && window.history.state.back
      if (typeof back === 'string' && back && !back.startsWith('/orgs')) {
        router.back()
        return
      }
      router.replace(fallback())
    }
    const load = async () => {
      try {
        const res = await orgAPI.list(query.value.trim())
        orgs.value = res.data || []
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '机构加载失败' })
      } finally {
        loaded.value = true
      }
    }
    watch(query, () => {
      clearTimeout(timer)
      timer = setTimeout(load, 220)
    })
    onMounted(load)
    return { orgs, query, loaded, goBack, load }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40px; background: #eef3fb; }
.intro { padding: 8px 20px 4px; }
.kicker { font-size: 11px; letter-spacing: 0.14em; color: #2459ff; font-weight: 800; }
.intro h1 { margin: 6px 0; font-size: 22px; color: #0b1633; }
.intro p { margin: 0; font-size: 13px; color: rgba(11,22,51,0.55); line-height: 1.6; }
.search { margin: 12px 16px 0; }
.search input {
  width: 100%; height: 44px; border: none; border-radius: 14px; padding: 0 14px;
  background: #fff; border: 1px solid rgba(11,22,51,0.06);
  box-shadow: 0 12px 36px rgba(11,22,51,0.06); font-size: 14px; color: #0b1633;
}
.card {
  margin: 12px 16px; padding: 16px; background: #fff; border-radius: 20px;
  border: 1px solid rgba(11,22,51,0.06); display: flex; gap: 14px;
  box-shadow: 0 12px 36px rgba(11,22,51,0.06);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
@media (hover: hover) and (pointer: fine) {
  .card:hover {
    transform: translateY(-3px);
    border-color: rgba(36, 89, 255, 0.32);
    box-shadow: 0 16px 32px rgba(31, 91, 255, 0.16);
  }
}
.mark {
  width: 52px; height: 52px; border-radius: 16px; color: #fff;
  font-size: 20px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.logo {
  width: 52px; height: 52px; border-radius: 16px; object-fit: contain; background: #f4f7fb; flex-shrink: 0;
}
.city { font-size: 12px; color: rgba(11,22,51,0.45); }
.body h2 { margin: 4px 0; font-size: 18px; }
.body p { margin: 0 0 8px; font-size: 13px; color: rgba(11,22,51,0.6); line-height: 1.5; }
.empty { text-align: center; color: rgba(11,22,51,0.45); font-size: 13px; padding: 24px 16px; }
</style>
