<template>
  <div class="page">
    <van-nav-bar title="学习排行榜" left-arrow @click-left="$router.back()">
      <template #right>
        <span class="share" @click="shareBoard">分享</span>
      </template>
    </van-nav-bar>
    <div v-if="!rows.length" class="empty">暂无公示数据。在「我的」打开排行榜公示后会出现。</div>
    <div v-for="row in rows" :key="row.rank" class="row">
      <span class="rank">{{ row.rank }}</span>
      <div class="meta">
        <b>{{ row.nickName }}</b>
        <span>打卡 {{ row.checkinTotalDays }} 天 · 错题 {{ row.questionCount }}</span>
      </div>
      <span class="score">{{ row.score }}</span>
    </div>
  </div>
</template>
<script>
import { ref, onMounted } from 'vue'
import { showToast } from 'vant'
import userAPI from '../api/user'
export default {
  name: 'LeaderboardPage',
  setup() {
    const rows = ref([])
    onMounted(async () => {
      const res = await userAPI.leaderboard()
      rows.value = res.data || []
    })
    const shareBoard = async () => {
      const url = window.location.origin + '/leaderboard'
      const top = rows.value[0]
      const text = top
        ? `智卷错题通排行榜第一名是 ${top.nickName}，来看看你能排第几`
        : '智卷错题通学习排行榜，打开公示后就能上榜'
      try {
        if (navigator.share) {
          await navigator.share({ title: '学习排行榜', text, url })
          return
        }
        await navigator.clipboard.writeText(text + '\n' + url)
        showToast({ type: 'success', message: '链接已复制' })
      } catch (e) {
        if (e?.name === 'AbortError') return
        showToast({ type: 'fail', message: '分享失败' })
      }
    }
    return { rows, shareBoard }
  }
}
</script>
<style scoped>
.page { min-height: 100vh; background: #eef3fb; padding-bottom: 24px; }
.share { color: #2459ff; font-weight: 700; font-size: 14px; }
.row { display: flex; align-items: center; gap: 12px; background: #fff; margin: 10px 16px; padding: 12px; border-radius: 14px; }
.rank { width: 28px; font-weight: 800; color: #2459ff; }
.meta { flex: 1; display: flex; flex-direction: column; }
.meta span { font-size: 12px; color: rgba(11,22,51,0.5); }
.empty { padding: 40px 20px; text-align: center; color: rgba(11,22,51,0.5); }
</style>
