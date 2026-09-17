<template>
  <div class="profile-page">
    <div class="hero">
      <label class="avatar-btn">
        <img class="avatar-img" :src="profile.avatarUrl || defaultAvatar" alt="" />
        <input type="file" accept="image/*" hidden @change="onAvatar" />
      </label>
      <div class="hero-name">{{ profile.nickName || '未设置昵称' }}</div>
      <div class="hero-level">Lv.{{ ach.level }} {{ ach.levelName }}</div>
      <div class="hero-stats">
        <div class="stat-block"><b>{{ stats.totalQuestions || 0 }}</b><span>错题数</span></div>
        <div class="stat-block"><b>{{ stats.totalCategories || 0 }}</b><span>分类数</span></div>
      </div>
    </div>

    <section class="card">
      <h3>学习打卡</h3>
      <div class="week-row">
        <div v-for="d in wallet.recentDays || []" :key="d.dayKey" class="week-cell" :class="{ on: d.checked, today: d.isToday }">
          {{ d.checked ? '✓' : d.day }}
        </div>
      </div>
      <div class="mini-row">
        <div><b>{{ wallet.checkinStreak || 0 }}</b><span>连续</span></div>
        <div><b>{{ wallet.checkinTotalDays || 0 }}</b><span>累计</span></div>
        <div><b>{{ wallet.coins || 0 }}</b><span>金币</span></div>
      </div>
      <div class="bonus-row">
        <span class="bonus">基础 +{{ wallet.todayBonus?.base || 10 }}</span>
        <span class="bonus" :class="{ on: wallet.todayBonus?.chat }">对话 +{{ wallet.todayBonus?.chat || 0 }}</span>
        <span class="bonus" :class="{ on: wallet.todayBonus?.paper }">组卷 +{{ wallet.todayBonus?.paper || 0 }}</span>
        <span class="bonus total">今日可得 {{ wallet.todayBonus?.total || 10 }}</span>
      </div>
      <button class="primary" :disabled="wallet.todayChecked || checking" @click="doCheckin">
        {{ wallet.todayChecked ? '今日已打卡' : '今日打卡' }}
      </button>
      <button class="ghost-wide" :disabled="sharing" @click="shareCheckinCard">
        {{ sharing ? '正在生成…' : '生成打卡分享图' }}
      </button>
      <button class="ghost-wide" @click="$router.push('/community')">学习社区（互助 / PK / 打卡）</button>
      <div class="vip-row">
        <div>
          <div class="vip-title">{{ wallet.isVip ? '对话会员' : '对话会员 · 未开通' }}</div>
          <div class="vip-sub">{{ wallet.isVip ? ('有效期至 ' + wallet.vipExpireText) : '每次兑换 7 天，期间对话不限量' }}</div>
        </div>
        <button class="ghost" @click="doVip">兑换 {{ wallet.vipCost || 200 }} 金币</button>
      </div>
    </section>

    <section class="card">
      <h3>成就</h3>
      <div class="ach-level">Lv.{{ ach.level }} {{ ach.levelName }} · {{ ach.xp }} 经验</div>
      <div class="bar"><i :style="{ width: ach.progressPct + '%' }"></i></div>
      <div class="medal-grid">
        <div v-for="m in ach.medals" :key="m.id" class="medal" :class="{ on: m.unlocked }" @click="showMedal(m)">
          <div class="mark">{{ m.mark }}</div>
          <span>{{ m.name }}</span>
        </div>
      </div>
    </section>

    <section class="card">
      <h3>个人资料</h3>
      <label class="field">昵称<input v-model="form.nickName" maxlength="20" /></label>
      <label class="field">学段
        <select v-model="form.stage">
          <option value="">未选择</option>
          <option>小学</option><option>初中</option><option>高中</option><option>大学</option>
        </select>
      </label>
      <label class="field">学校<input v-model="form.school" maxlength="60" placeholder="选填" /></label>
      <label class="field">班级<input v-model="form.className" maxlength="60" placeholder="选填" /></label>
      <label class="check"><input type="checkbox" v-model="form.leaderboardPublic" /> 在排行榜公示我的学习数据</label>
      <button class="primary" @click="saveProfile">保存资料</button>
    </section>

    <section class="card">
      <h3>修改密码</h3>
      <label class="field">原密码<input v-model="pwd.oldPassword" type="password" maxlength="40" /></label>
      <label class="field">新密码<input v-model="pwd.newPassword" type="password" maxlength="40" placeholder="至少 4 位" /></label>
      <button class="primary" :disabled="changingPwd" @click="changePassword">
        {{ changingPwd ? '修改中…' : '修改密码' }}
      </button>
    </section>

    <section class="card list">
      <button v-if="isTeacherAccount" @click="$router.push('/teacher')">班级工作台</button>
      <button v-if="isTeacherAccount" @click="$router.push('/teacher/questions')">全班题目</button>
      <button v-if="isTeacherAccount" @click="$router.push('/teacher/paper')">班级组卷</button>
      <template v-if="!isTeacherAccount">
        <button @click="$router.push('/classroom')">我的老师 / 班级</button>
        <button @click="$router.push('/homework')">我的作业</button>
        <button @click="$router.push('/class-notebooks')">班级错题本</button>
        <button @click="$router.push('/parent-reports')">家长端报告</button>
        <button @click="$router.push('/practice')">开始练习</button>
        <button @click="$router.push('/paper-builder')">组合试卷</button>
        <button @click="$router.push('/learning-report')">查询你的个性化学习报告</button>
        <button @click="$router.push('/report-list')">错因分析历史</button>
        <button @click="$router.push('/variant-list')">已保存变式题</button>
      </template>
      <button @click="$router.push('/community')">学习社区</button>
      <button @click="$router.push('/community/help')">互助答疑</button>
      <button @click="$router.push('/community/pk')">好友 PK</button>
      <button @click="$router.push('/plaza')">打卡广场</button>
      <button @click="$router.push('/leaderboard')">学习排行榜</button>
      <button @click="$router.push('/orgs')">机构目录</button>
      <button @click="$router.push('/settings')">设置</button>
      <button class="danger" @click="logout">退出登录</button>
      <button class="danger" @click="deleteAccount">注销账号</button>
    </section>

    <AppTabBar v-if="!isTeacherAccount" />
    <TeacherTabBar v-else />

    <div v-if="cardPreview" class="share-mask" @click.self="closeShareCard">
      <div class="share-sheet">
        <img :src="cardPreview" alt="打卡分享图" />
        <p>长按图片可保存到相册。电脑端点下载。</p>
        <button class="primary" @click="downloadShareCard">下载图片</button>
        <button class="ghost-wide" @click="goPlaza">发到打卡广场</button>
        <button class="ghost-wide" @click="closeShareCard">关闭</button>
      </div>
    </div>
  </div>
</template>

<script>
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog, showDialog } from 'vant'
import AppTabBar from '../components/AppTabBar.vue'
import TeacherTabBar from '../components/TeacherTabBar.vue'
import userAPI from '../api/user'
import { uploadClient, API_BASE_URL } from '../api/config'
import { setSession, clearSession, getProfile, isTeacher } from '../utils/auth'
import { buildAchievements, EMPTY_ACH } from '../utils/achievements'
import { shareCheckin, downloadBlob } from '../utils/shareCard'

export default {
  name: 'ProfilePage',
  components: { AppTabBar, TeacherTabBar },
  setup() {
    const router = useRouter()
    const isTeacherAccount = isTeacher()
    const defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="%23d9e4f5"/><circle cx="40" cy="30" r="14" fill="%2390a4c4"/><ellipse cx="40" cy="64" rx="22" ry="16" fill="%2390a4c4"/></svg>'
    const profile = reactive(getProfile() || { nickName: '匿名用户' })
    const form = reactive({
      nickName: profile.nickName || '匿名用户',
      stage: profile.stage || '',
      school: profile.school || '',
      className: profile.className || '',
      leaderboardPublic: !!profile.leaderboardPublic
    })
    const wallet = reactive({})
    const stats = reactive({})
    const ach = ref(EMPTY_ACH)
    const checking = ref(false)
    const pwd = reactive({ oldPassword: '', newPassword: '' })
    const changingPwd = ref(false)
    const sharing = ref(false)
    const cardPreview = ref('')
    const cardBlob = ref(null)

    const load = async () => {
      const [me, w, s] = await Promise.all([userAPI.me(), userAPI.wallet(), userAPI.stats()])
      Object.assign(profile, me.data || {})
      Object.assign(form, {
        nickName: profile.nickName,
        stage: profile.stage || '',
        school: profile.school || '',
        className: profile.className || '',
        leaderboardPublic: !!profile.leaderboardPublic
      })
      Object.assign(wallet, w.data || {})
      Object.assign(stats, s.data || {})
      ach.value = buildAchievements({ ...stats, ...wallet })
      setSession(localStorage.getItem('mn_token'), profile)
    }

    const doCheckin = async () => {
      checking.value = true
      try {
        const res = await userAPI.checkin()
        Object.assign(wallet, res.data || {})
        await load()
        const gained = res.data?.rewarded
        showToast({ type: 'success', message: gained ? `打卡成功 +${gained} 金币` : '打卡成功' })
        if (res.data?.canSharePlaza !== false) {
          try {
            await showConfirmDialog({
              title: '分享到打卡广场？',
              message: '网页端可以把今日打卡发到广场，同学能看见并点赞。小程序审核不便做的社区功能，这里可以用。',
              confirmButtonText: '去广场发布'
            })
            router.push('/plaza')
          } catch { /* 取消 */ }
        }
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '打卡失败' })
      } finally { checking.value = false }
    }

    const doVip = async () => {
      try {
        const res = await userAPI.redeemVip()
        Object.assign(wallet, res.data || {})
        showToast({ type: 'success', message: '兑换成功' })
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '兑换失败' })
      }
    }

    const saveProfile = async () => {
      const res = await userAPI.updateProfile(form)
      Object.assign(profile, res.data || {})
      setSession(localStorage.getItem('mn_token'), profile)
      showToast({ type: 'success', message: '已保存' })
    }

    const onAvatar = async (e) => {
      const file = e.target.files && e.target.files[0]
      if (!file) return
      const fd = new FormData()
      fd.append('file', file)
      const up = await uploadClient.post('/upload/file', fd)
      const url = up.data?.data?.url || up.data?.url
      if (!url) {
        showToast({ type: 'fail', message: '头像上传失败' })
        return
      }
      const abs = url.startsWith('http') ? url : (API_BASE_URL.replace(/\/$/, '') + url)
      await userAPI.updateProfile({ avatarUrl: abs })
      profile.avatarUrl = abs
      showToast({ type: 'success', message: '头像已更新' })
    }

    const changePassword = async () => {
      if (!pwd.oldPassword || !pwd.newPassword) {
        showToast('请填写原密码和新密码')
        return
      }
      changingPwd.value = true
      try {
        const res = await userAPI.changePassword(pwd.oldPassword, pwd.newPassword)
        if (res.data?.token) setSession(res.data.token, profile)
        pwd.oldPassword = ''
        pwd.newPassword = ''
        showToast({ type: 'success', message: '密码已修改' })
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '修改失败' })
      } finally {
        changingPwd.value = false
      }
    }

    const closeShareCard = () => {
      if (cardPreview.value) URL.revokeObjectURL(cardPreview.value)
      cardPreview.value = ''
      cardBlob.value = null
    }

    const shareCheckinCard = async () => {
      sharing.value = true
      try {
        closeShareCard()
        const res = await shareCheckin({
          nickName: profile.nickName,
          streak: wallet.checkinStreak,
          totalDays: wallet.checkinTotalDays,
          questionCount: stats.totalQuestions,
          coins: wallet.coins
        })
        cardBlob.value = res.blob
        cardPreview.value = res.previewUrl
      } catch (e) {
        console.error(e)
        showToast({ type: 'fail', message: e?.message || '生成分享图失败' })
      } finally {
        sharing.value = false
      }
    }

    const downloadShareCard = () => {
      if (!cardBlob.value) return
      downloadBlob(cardBlob.value, 'zhi-juan-checkin.png')
      showToast({ type: 'success', message: '已开始下载' })
    }

    const goPlaza = () => {
      closeShareCard()
      router.push('/plaza')
    }

    const showMedal = (m) => {
      showDialog({ title: m.name, message: m.unlocked ? m.desc + '\n\n已点亮' : m.desc + '\n\n未点亮：' + m.hint })
    }

    const logout = () => {
      clearSession()
      router.replace('/login')
    }

    const deleteAccount = async () => {
      try {
        await showConfirmDialog({
          title: '注销账号',
          message: '将永久删除你的错题、分类、报告和打卡记录，且无法恢复。'
        })
        await userAPI.deleteAccount()
        clearSession()
        showToast({ type: 'success', message: '账号已注销' })
        router.replace('/login')
      } catch (e) {
        if (e === 'cancel' || e === 'close') return
        showToast({ type: 'fail', message: e.response?.data?.message || '注销失败' })
      }
    }

    onMounted(() => { load().catch(() => {}) })
    return {
      profile, form, wallet, stats, ach, checking, defaultAvatar, pwd, changingPwd,
      isTeacherAccount, sharing, cardPreview,
      doCheckin, doVip, saveProfile, onAvatar, showMedal, logout, deleteAccount,
      changePassword, shareCheckinCard, closeShareCard, downloadShareCard, goPlaza
    }
  }
}
</script>

<style scoped>
.profile-page { padding: 20px 16px 90px; background: #eef3fb; min-height: 100vh; }
.hero { text-align: center; margin-bottom: 16px; }
.avatar-img { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; }
.hero-name { margin-top: 8px; font-size: 20px; font-weight: 800; color: #0b1633; }
.hero-level { color: #2459ff; font-weight: 700; font-size: 13px; }
.hero-stats { display: flex; justify-content: center; gap: 28px; margin-top: 12px; }
.stat-block { display: flex; flex-direction: column; }
.stat-block b { font-size: 20px; color: #0b1633; }
.stat-block span { font-size: 12px; color: rgba(11,22,51,0.5); }
.card { background: #fff; border-radius: 18px; padding: 16px; margin-bottom: 12px; border: 1px solid rgba(11,22,51,0.06); }
.card h3 { margin: 0 0 12px; font-size: 15px; }
.week-row { display: flex; gap: 6px; margin-bottom: 12px; }
.week-cell { flex: 1; height: 36px; border-radius: 10px; background: #f4f7fb; text-align: center; line-height: 36px; font-size: 12px; }
.week-cell.on { background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; }
.mini-row { display: flex; justify-content: space-around; margin-bottom: 12px; text-align: center; }
.mini-row span { display: block; font-size: 12px; color: rgba(11,22,51,0.5); }
.primary { width: 100%; height: 42px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.ghost { border: none; background: #eef3fb; color: #2459ff; border-radius: 999px; padding: 8px 12px; font-weight: 700; }
.ghost-wide { width: 100%; margin-top: 8px; border: none; background: #eef3fb; color: #2459ff; border-radius: 999px; padding: 11px; font-weight: 700; }
.ghost-wide:disabled { opacity: 0.45; }
.bonus-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.bonus { font-size: 11px; padding: 4px 10px; border-radius: 999px; background: #f4f7fb; color: rgba(11,22,51,0.45); }
.bonus.on { background: rgba(22,163,74,0.12); color: #16a34a; }
.bonus.total { margin-left: auto; background: rgba(36,89,255,0.12); color: #2459ff; font-weight: 700; }
.vip-row { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; gap: 8px; }
.vip-title { font-weight: 700; }
.vip-sub { font-size: 12px; color: rgba(11,22,51,0.5); }
.bar { height: 8px; background: #eef3fb; border-radius: 99px; overflow: hidden; margin: 8px 0 12px; }
.bar i { display: block; height: 100%; background: linear-gradient(90deg,#2459ff,#52b7ff); }
.medal-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.medal { text-align: center; font-size: 11px; color: rgba(11,22,51,0.4); }
.medal.on { color: #0b1633; }
.mark { width: 36px; height: 36px; margin: 0 auto 4px; border-radius: 10px; line-height: 36px; background: #eef3fb; font-weight: 800; }
.medal.on .mark { background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; }
.field { display: block; margin-bottom: 10px; font-size: 13px; color: rgba(11,22,51,0.5); }
.field input, .field select { display: block; width: 100%; height: 40px; margin-top: 4px; border: none; background: #f4f7fb; border-radius: 10px; padding: 0 10px; }
.check { display: flex; gap: 8px; align-items: center; margin: 8px 0 12px; font-size: 13px; }
.list button { display: block; width: 100%; text-align: left; background: none; border: none; border-bottom: 1px solid rgba(11,22,51,0.06); padding: 14px 0; font-size: 15px; color: #0b1633; }
.danger { color: #e11d48 !important; }
.share-mask {
  position: fixed; inset: 0; z-index: 3000;
  background: rgba(11,22,51,0.55);
  display: flex; align-items: center; justify-content: center;
  padding: 24px 16px;
}
.share-sheet {
  width: min(420px, 100%);
  background: #fff; border-radius: 20px; padding: 16px;
}
.share-sheet img {
  width: 100%; border-radius: 14px; display: block;
  background: #eef3fb;
}
.share-sheet p {
  margin: 10px 0 8px; text-align: center;
  font-size: 13px; color: rgba(11,22,51,0.55);
}
</style>
