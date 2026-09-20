<template>
  <div class="page">
    <van-nav-bar title="机构版" left-arrow @click-left="goBack" />
    <div class="intro">
      <div class="kicker">INSTITUTION</div>
      <h1>演示案例 + 真实入驻机构</h1>
      <p>老师开通并公开发布后会出现在这里。学生用加入码申请，老师通过后才会进入机构。</p>
    </div>
    <article v-for="org in orgs" :key="org.slug" class="card" @click="$router.push('/orgs/' + org.slug)">
      <img v-if="org.logoUrl" class="logo" :src="org.logoUrl" alt="" />
      <div v-else class="mark" :style="{ background: org.theme?.primary }">{{ org.mark }}</div>
      <div class="body">
        <div class="city">{{ org.city || '未填城市' }} · {{ org.classCount || 0 }} 个班 · {{ org.studentCount || 0 }} 人 · {{ org.demo ? '演示' : '真实租户' }}</div>
        <h2>{{ org.name }}</h2>
        <p>{{ org.tagline }}</p>
        <b>{{ org.headline }}</b>
      </div>
    </article>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import orgAPI from '../api/org'
import { isLoggedIn } from '../utils/auth'

export default {
  name: 'OrgCases',
  setup() {
    const router = useRouter()
    const orgs = ref([])
    const goBack = () => {
      if (window.history.length > 1) router.back()
      else router.push(isLoggedIn() ? '/profile' : '/login')
    }
    onMounted(async () => {
      try {
        const res = await orgAPI.list()
        orgs.value = res.data || []
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '案例加载失败' })
      }
    })
    return { orgs, goBack }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40px; background: #eef3fb; }
.intro { padding: 8px 20px 4px; }
.kicker { font-size: 11px; letter-spacing: 0.14em; color: #2459ff; font-weight: 800; }
.intro h1 { margin: 6px 0; font-size: 22px; color: #0b1633; }
.intro p { margin: 0; font-size: 13px; color: rgba(11,22,51,0.55); line-height: 1.6; }
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
.body b { font-size: 13px; color: #2459ff; }
</style>
