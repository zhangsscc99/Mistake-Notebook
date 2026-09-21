<template>
  <div class="page" :style="pageStyle">
    <van-nav-bar :title="org.shortName || '机构'" left-arrow @click-left="goBack" fixed placeholder />
    <div class="hero" :style="heroStyle">
      <img v-if="org.logoUrl" class="logo" :src="org.logoUrl" alt="" />
      <div v-else class="mark">{{ org.mark }}</div>
      <div class="city">{{ org.city }}{{ org.demo ? ' · 示例' : '' }}</div>
      <h1>{{ org.name }}</h1>
      <p v-if="org.tagline">{{ org.tagline }}</p>
    </div>
    <div class="stats">
      <div><b>{{ org.studentCount || 0 }}</b><span>学员</span></div>
    </div>
    <div v-if="!org.demo" class="actions">
      <template v-if="org.membership === 'approved'">
        <button class="primary" type="button" @click="goBank">查看专属题库</button>
        <button class="ghost" type="button" @click="leave">退出机构</button>
      </template>
      <template v-else-if="org.membership === 'pending'">
        <button class="ghost" type="button" disabled>已申请，等待通过</button>
        <button class="ghost" type="button" @click="leave">取消申请</button>
      </template>
      <button v-else-if="org.membership === 'owner' || org.membership === 'staff'" class="ghost" type="button" @click="$router.push('/teacher/org')">管理机构</button>
      <button v-else-if="loggedIn && org.membership !== 'teacher'" class="primary" type="button" :disabled="applying" @click="apply">
        {{ applying ? '提交中…' : '申请加入' }}
      </button>
      <button v-else-if="!loggedIn" class="primary" type="button" @click="goLogin">登录后申请加入</button>
    </div>
    <p class="foot">{{ org.demo ? '以上为示例内容。' : '通过后即可查看该机构的专属题库。' }}</p>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import orgAPI from '../api/org'
import { isLoggedIn, isTeacher } from '../utils/auth'

export default {
  name: 'OrgCaseDetail',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const org = ref({})
    const applying = ref(false)
    const loggedIn = computed(() => isLoggedIn())
    const goBack = () => {
      const back = window.history.state && window.history.state.back
      if (typeof back === 'string' && back && back !== route.fullPath) {
        router.back()
        return
      }
      router.replace('/orgs')
    }
    const primary = computed(() => org.value.theme?.primary || '#2459ff')
    const accent = computed(() => org.value.theme?.accent || '#52b7ff')
    const pageStyle = computed(() => ({
      '--org': primary.value,
      '--org2': accent.value
    }))
    const heroStyle = computed(() => ({
      background: `linear-gradient(135deg, ${primary.value}, ${accent.value})`
    }))
    const load = async () => {
      const res = await orgAPI.detail(route.params.slug)
      org.value = res.data || {}
      document.title = org.value.name + (org.value.demo ? ' - 机构案例' : ' - 机构主页')
    }
    const goLogin = () => {
      router.push({ path: '/login', query: { redirect: route.fullPath } })
    }
    const goBank = () => {
      router.push('/orgs/' + route.params.slug + '/bank')
    }
    const apply = async () => {
      if (!isLoggedIn()) {
        goLogin()
        return
      }
      if (isTeacher()) {
        showToast('请用学生账号申请加入')
        return
      }
      applying.value = true
      try {
        const res = await orgAPI.apply(route.params.slug)
        showToast({ type: 'success', message: res.message || '已提交加入申请' })
        await load()
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '申请失败' })
      } finally {
        applying.value = false
      }
    }
    const leave = async () => {
      const pending = org.value.membership === 'pending'
      try {
        await showConfirmDialog({
          title: pending ? '取消申请' : '退出机构',
          message: pending ? '取消后如需加入，要重新提交申请。' : '退出后将无法再看专属题库，可重新申请。'
        })
        const res = await orgAPI.leave(route.params.slug)
        showToast({ type: 'success', message: res.message || (pending ? '已取消申请' : '已退出机构') })
        await load()
      } catch (e) {
        if (e === 'cancel') return
        showToast({ type: 'fail', message: e.response?.data?.message || '操作失败' })
      }
    }
    onMounted(async () => {
      try {
        await load()
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '案例不存在' })
      }
    })
    return { org, applying, loggedIn, pageStyle, heroStyle, goBack, goLogin, goBank, apply, leave }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40px; background: #eef3fb; }
.hero {
  margin: 12px 16px; padding: 20px 18px; border-radius: 20px; color: #fff;
}
.mark {
  width: 44px; height: 44px; border-radius: 14px; background: rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px;
}
.logo {
  width: 56px; height: 56px; border-radius: 14px; object-fit: contain; background: #fff;
}
.city { margin-top: 12px; font-size: 12px; opacity: 0.85; }
.hero h1 { margin: 6px 0; font-size: 24px; }
.hero p { margin: 0; font-size: 13px; line-height: 1.6; opacity: 0.92; }
.stats {
  margin: 0 16px 12px; display: flex; background: #fff; border-radius: 16px;
  border: 1px solid rgba(11,22,51,0.06);
}
.stats div { flex: 1; text-align: center; padding: 12px 0; }
.stats b { display: block; color: #0b1633; }
.stats span { font-size: 11px; color: rgba(11,22,51,0.5); }
.actions { margin: 0 16px 16px; display: flex; flex-direction: column; gap: 10px; }
.primary, .ghost {
  width: 100%; height: 46px; border: none; border-radius: 999px; font-weight: 700; font-size: 15px;
}
.primary {
  color: #fff; background: linear-gradient(135deg, #2459ff, #52b7ff);
  box-shadow: 0 10px 24px rgba(31,91,255,0.30);
}
.ghost {
  background: #fff; color: #2459ff; border: 1px solid rgba(36,89,255,0.28);
}
.ghost:disabled { color: rgba(11,22,51,0.4); border-color: rgba(11,22,51,0.08); }
.foot { text-align: center; font-size: 12px; color: rgba(11,22,51,0.4); padding: 0 20px; }
</style>
