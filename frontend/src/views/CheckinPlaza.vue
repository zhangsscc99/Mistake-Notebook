<template>
  <div class="page">
    <van-nav-bar title="打卡广场" left-arrow @click-left="$router.push('/community')" />

    <div class="composer card">
      <div class="kicker">今日打卡</div>
      <h2>把今日打卡晒出来</h2>
      <p>每天一条，同学能点赞。连续天数会一起显示。</p>
      <textarea v-model="draft" maxlength="80" placeholder="写一句今天的学习状态，选填"></textarea>
      <div class="composer-row">
        <span>{{ draft.length }}/80</span>
        <button class="primary sm" :disabled="publishing" @click="publish">{{ publishing ? '发布中…' : '分享今日打卡' }}</button>
      </div>
    </div>

    <div v-if="!posts.length && !loading" class="empty">还没有人分享打卡。你来做第一条。</div>
    <article v-for="post in posts" :key="post.id" class="card post">
      <div class="post-head">
        <img class="avatar" :src="post.avatarUrl || defaultAvatar" alt="" />
        <div>
          <b>{{ post.nickName || '同学' }}</b>
          <span>{{ post.dayKey }}{{ post.mine ? ' · 我' : '' }}</span>
        </div>
      </div>
      <p class="content">{{ post.content }}</p>
      <div class="stats">
        <i>连续 {{ post.streak }} 天</i>
        <i>累计 {{ post.totalDays }} 天</i>
        <i>错题 {{ post.questionCount }}</i>
      </div>
      <button class="like" :class="{ on: post.liked }" @click="like(post)">
        {{ post.liked ? '已赞' : '点赞' }} {{ post.likeCount || 0 }}
      </button>
    </article>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { showToast } from 'vant'
import userAPI from '../api/user'

export default {
  name: 'CheckinPlaza',
  setup() {
    const defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="%23d9e4f5"/><circle cx="40" cy="30" r="14" fill="%2390a4c4"/><ellipse cx="40" cy="64" rx="22" ry="16" fill="%2390a4c4"/></svg>'
    const posts = ref([])
    const draft = ref('')
    const publishing = ref(false)
    const loading = ref(true)

    const load = async () => {
      loading.value = true
      try {
        const res = await userAPI.checkinFeed()
        posts.value = res.data || []
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })
      } finally {
        loading.value = false
      }
    }

    const publish = async () => {
      publishing.value = true
      try {
        await userAPI.shareCheckin(draft.value)
        draft.value = ''
        showToast({ type: 'success', message: '已发到广场' })
        await load()
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '发布失败' })
      } finally {
        publishing.value = false
      }
    }

    const like = async (post) => {
      try {
        const res = await userAPI.likeCheckin(post.id)
        post.liked = !!res.data?.liked
        post.likeCount = res.data?.likeCount || 0
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '点赞失败' })
      }
    }

    onMounted(load)
    return { posts, draft, publishing, loading, defaultAvatar, publish, like }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding-bottom: 40px;
  background-color: #eef3fb;
  background-image:
    radial-gradient(circle 280px at 100% 0%, rgba(82,183,255,0.12) 0%, transparent 60%),
    radial-gradient(circle 240px at 0% 4%, rgba(182,166,255,0.10) 0%, transparent 55%);
}
.card {
  background: #fff;
  margin: 12px 16px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(11,22,51,0.06);
}
.composer .kicker { font-size: 12px; color: #2459ff; font-weight: 700; }
.composer h2 { margin: 4px 0 6px; font-size: 20px; color: #0b1633; }
.composer p { margin: 0 0 12px; font-size: 13px; color: rgba(11,22,51,0.5); line-height: 1.6; }
textarea {
  width: 100%;
  min-height: 76px;
  border: none;
  background: #f4f7fb;
  border-radius: 12px;
  padding: 10px 12px;
  resize: none;
  font-size: 14px;
}
.composer-row { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; font-size: 12px; color: rgba(11,22,51,0.4); }
.primary {
  border: none;
  border-radius: 999px;
  color: #fff;
  font-weight: 700;
  background: linear-gradient(135deg,#2459ff,#52b7ff);
}
.primary.sm { height: 36px; padding: 0 16px; }
.post-head { display: flex; gap: 10px; align-items: center; }
.avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
.post-head b { display: block; color: #0b1633; }
.post-head span { font-size: 12px; color: rgba(11,22,51,0.45); }
.content { margin: 12px 0; font-size: 15px; line-height: 1.7; color: #0b1633; }
.stats { display: flex; gap: 8px; flex-wrap: wrap; }
.stats i { font-style: normal; font-size: 11px; padding: 4px 8px; border-radius: 999px; background: #f4f7fb; color: rgba(11,22,51,0.55); }
.like {
  margin-top: 12px;
  border: none;
  background: #eef3fb;
  color: #2459ff;
  border-radius: 999px;
  height: 34px;
  padding: 0 14px;
  font-weight: 700;
}
.like.on { background: rgba(36,89,255,0.12); }
.empty { padding: 40px 20px; text-align: center; color: rgba(11,22,51,0.45); }
</style>
