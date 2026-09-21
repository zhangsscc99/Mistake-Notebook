<template>
  <div class="page">
    <div class="hero">
      <div class="kicker">COMMUNITY</div>
      <h1>学习社区</h1>
      <p>互助答疑、打卡广场和好友 PK，把卡住的题和今日进度晒给同学。</p>
    </div>

    <div class="stats">
      <button class="stat" @click="$router.push('/community/help')">
        <b>{{ home.helpCount || 0 }}</b><span>互助帖</span>
      </button>
      <button class="stat" @click="$router.push('/plaza')">
        <b>{{ home.plazaCount || 0 }}</b><span>打卡动态</span>
      </button>
      <button class="stat" @click="$router.push('/community/pk')">
        <b>{{ home.friendCount || 0 }}</b><span>好友</span>
      </button>
    </div>

    <div class="grid">
      <button class="tile" @click="$router.push('/community/help')">
        <i>互助</i>
        <b>互助答疑</b>
        <span>卡住的题发出来，同学按步骤回。</span>
      </button>
      <button class="tile" @click="$router.push('/community/pk')">
        <i>PK</i>
        <b>好友 PK</b>
        <span>{{ home.pendingPkCount ? home.pendingPkCount + ' 场待应战' : '错题互抽作答，也可比战力' }}</span>
      </button>
      <button class="tile" @click="$router.push('/plaza')">
        <i>打卡</i>
        <b>打卡广场</b>
        <span>把今日打卡晒给同学看。</span>
      </button>
      <button class="tile" @click="$router.push('/leaderboard')">
        <i>榜</i>
        <b>学习排行</b>
        <span>公开连续打卡与错题量。</span>
      </button>
    </div>

    <div class="section-head">最新互助</div>
    <article v-for="post in home.recentHelp || []" :key="post.id" class="card post" @click="$router.push('/community/help/' + post.id)">
      <div class="meta">
        <em v-if="post.subject">{{ post.subject }}</em>
        <span>{{ post.nickName }} · {{ fmt(post.createdAt) }}</span>
      </div>
      <b>{{ post.title }}</b>
      <p>{{ post.preview }}</p>
      <i>{{ post.likeCount || 0 }} 赞 · {{ post.replyCount }} 条回复</i>
    </article>
    <p v-if="!(home.recentHelp || []).length" class="empty">还没有互助帖。</p>

    <div class="section-head">最近对战</div>
    <article v-for="m in home.recentPk || []" :key="m.id" class="card pk" @click="$router.push(m.playable || m.mode === 'QUIZ' ? '/community/pk/' + m.id : '/community/pk')">
      <b>{{ (m.challenger && m.challenger.nickName) || '同学' }} vs {{ (m.opponent && m.opponent.nickName) || '同学' }}</b>
      <span>{{ m.result }} · {{ fmt(m.createdAt) }}</span>
    </article>
    <p v-if="!(home.recentPk || []).length" class="empty">加好友后就能发起 PK。</p>

    <AppTabBar />
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { showToast } from 'vant'
import AppTabBar from '../components/AppTabBar.vue'
import socialAPI from '../api/social'

export default {
  name: 'CommunityHub',
  components: { AppTabBar },
  setup() {
    const home = ref({})
    const load = async () => {
      try {
        const res = await socialAPI.home()
        home.value = res.data || {}
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '社区加载失败' })
      }
    }
    onMounted(load)
    const fmt = (t) => (t ? String(t).replace('T', ' ').slice(0, 16) : '')
    return { home, fmt }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 18px 16px 90px;
  background-color: #eef3fb;
  background-image:
    radial-gradient(circle 420px at 100% 0%, rgba(82,183,255,0.12) 0%, transparent 60%),
    linear-gradient(rgba(11,22,51,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(11,22,51,0.025) 1px, transparent 1px);
  background-size: auto, 44px 44px, 44px 44px;
}
.hero {
  background: linear-gradient(135deg, #2459ff, #52b7ff);
  color: #fff;
  border-radius: 20px;
  padding: 18px;
}
.kicker { font-size: 11px; letter-spacing: 0.12em; opacity: 0.85; }
.hero h1 { margin: 6px 0; font-size: 24px; }
.hero p { margin: 0; font-size: 13px; line-height: 1.6; opacity: 0.92; }
.stats { display: flex; margin: 12px 0; background: #fff; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.stat {
  flex: 1; border: none; background: none; padding: 12px 0;
  border-left: 1px solid rgba(11,22,51,0.06);
  cursor: pointer;
  border-radius: 12px;
  transition: background-color 0.18s ease;
}
.stat:first-child { border-left: none; }
@media (hover: hover) and (pointer: fine) {
  button.stat:hover {
    background: rgba(36, 89, 255, 0.08);
    transform: none;
    box-shadow: none;
    border-color: rgba(11,22,51,0.06);
  }
}
.stat b { display: block; color: #0b1633; font-size: 18px; }
.stat span { font-size: 11px; color: rgba(11,22,51,0.5); }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; overflow: visible; }
.tile {
  text-align: left;
  background: #fff;
  border: 1px solid rgba(11,22,51,0.06);
  border-radius: 16px;
  padding: 14px 12px;
  box-shadow: 0 12px 36px rgba(11,22,51,0.04);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
@media (hover: hover) and (pointer: fine) {
  button.tile:hover {
    transform: translateY(-4px);
    border-color: rgba(36, 89, 255, 0.35);
    box-shadow: 0 18px 36px rgba(31, 91, 255, 0.20);
  }
  button.tile:hover i {
    background: linear-gradient(135deg, #2459ff, #52b7ff);
    color: #fff;
  }
}
.tile i {
  display: inline-block;
  font-style: normal;
  font-size: 11px;
  font-weight: 800;
  color: #2459ff;
  background: rgba(36,89,255,0.12);
  border-radius: 999px;
  padding: 2px 8px;
}
.tile b { display: block; margin: 8px 0 4px; color: #0b1633; font-size: 15px; }
.tile span { display: block; font-size: 12px; color: rgba(11,22,51,0.5); line-height: 1.5; }
.section-head { margin: 18px 2px 8px; font-weight: 800; color: #0b1633; }
.card {
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 8px;
  border: 1px solid rgba(11,22,51,0.06);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
@media (hover: hover) and (pointer: fine) {
  article.card:hover {
    transform: translateY(-4px);
    border-color: rgba(36, 89, 255, 0.32);
    box-shadow: 0 16px 32px rgba(31, 91, 255, 0.16);
  }
}
.post .meta { display: flex; justify-content: space-between; font-size: 12px; color: rgba(11,22,51,0.45); }
.post em { font-style: normal; color: #2459ff; font-weight: 700; }
.post b { display: block; margin: 8px 0 4px; color: #0b1633; }
.post p { margin: 0; font-size: 13px; color: rgba(11,22,51,0.65); line-height: 1.5; }
.post i { display: block; margin-top: 8px; font-style: normal; font-size: 12px; color: rgba(11,22,51,0.4); }
.pk { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.pk span { font-size: 12px; color: rgba(11,22,51,0.45); white-space: nowrap; }
.empty { font-size: 13px; color: rgba(11,22,51,0.45); padding: 4px 2px 8px; }
</style>
