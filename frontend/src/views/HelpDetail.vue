<template>
  <div class="page">
    <van-nav-bar title="互助详情" left-arrow @click-left="$router.push('/community/help')" />
    <div v-if="post.title" class="card">
      <div class="meta">
        <em v-if="post.subject">{{ post.subject }}</em>
        <span>{{ post.nickName }} · {{ post.createdAt }}</span>
      </div>
      <h1>{{ post.title }}</h1>
      <p class="body">{{ post.content }}</p>
      <p v-if="post.snippet" class="snippet">原题：{{ post.snippet }}</p>
      <button v-if="post.questionId" class="link" @click="$router.push('/explain/' + post.questionId)">查看附带错题</button>
      <div class="actions">
        <button class="ghost" @click="like">{{ post.liked ? '已赞' : '点赞' }} · {{ post.likeCount || 0 }}</button>
        <button v-if="post.mine" class="ghost danger" @click="removePost">删除帖子</button>
      </div>
    </div>

    <div class="section-head">回复 {{ (post.replies || []).length }}</div>
    <article v-for="reply in post.replies || []" :key="reply.id" class="card reply">
      <div class="meta">
        <b>{{ reply.nickName }}</b>
        <span>{{ reply.createdAt }}{{ reply.mine ? ' · 我' : '' }}</span>
      </div>
      <p>{{ reply.content }}</p>
      <button v-if="reply.mine" class="tiny" @click="removeReply(reply.id)">删除</button>
    </article>
    <p v-if="!(post.replies || []).length" class="empty">还没有回复，你来写第一步。</p>

    <div class="composer">
      <textarea v-model="draft" maxlength="500" placeholder="按步骤写，别只丢一个答案"></textarea>
      <button class="primary" :disabled="sending" @click="send">{{ sending ? '发送中…' : '回复' }}</button>
    </div>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import socialAPI from '../api/social'

export default {
  name: 'HelpDetail',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const post = ref({})
    const draft = ref('')
    const sending = ref(false)

    const load = async () => {
      try {
        const res = await socialAPI.helpDetail(route.params.id)
        post.value = res.data || {}
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })
      }
    }

    const send = async () => {
      sending.value = true
      try {
        const res = await socialAPI.replyHelp(route.params.id, draft.value)
        draft.value = ''
        post.value = res.data || {}
        showToast({ type: 'success', message: '已回复' })
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '回复失败' })
      } finally {
        sending.value = false
      }
    }

    const like = async () => {
      try {
        const res = await socialAPI.likeHelp(route.params.id)
        post.value = res.data || {}
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '点赞失败' })
      }
    }

    const removePost = async () => {
      await showConfirmDialog({ title: '删除帖子', message: '回复会一起删掉。' })
      try {
        await socialAPI.deleteHelp(route.params.id)
        showToast({ type: 'success', message: '已删除' })
        router.replace('/community/help')
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '删除失败' })
      }
    }

    const removeReply = async (id) => {
      await showConfirmDialog({ title: '删除回复', message: '确定删掉这条回复？' })
      try {
        const res = await socialAPI.deleteReply(route.params.id, id)
        post.value = res.data || {}
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '删除失败' })
      }
    }

    onMounted(load)
    return { post, draft, sending, send, like, removePost, removeReply }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 120px; background: #eef3fb; }
.card {
  background: #fff; margin: 12px 16px; padding: 16px; border-radius: 16px;
  border: 1px solid rgba(11,22,51,0.06);
}
.meta { display: flex; justify-content: space-between; font-size: 12px; color: rgba(11,22,51,0.45); }
em { font-style: normal; color: #2459ff; font-weight: 700; }
h1 { margin: 10px 0; font-size: 20px; color: #0b1633; }
.body { margin: 0; line-height: 1.7; color: #0b1633; }
.snippet {
  margin: 12px 0 0; padding: 10px 12px; background: #f4f7fb; border-radius: 12px;
  font-size: 13px; color: rgba(11,22,51,0.7); line-height: 1.6;
}
.actions { display: flex; gap: 8px; margin-top: 12px; }
.ghost, .link, .tiny {
  border: none; background: rgba(36,89,255,0.12); color: #2459ff; font-weight: 700;
  border-radius: 999px; height: 32px; padding: 0 12px; font-size: 12px;
}
.link { margin-top: 12px; }
.danger { background: rgba(225,29,72,0.1); color: #e11d48; }
.tiny { margin-top: 8px; height: 28px; }
.section-head { margin: 8px 18px; font-weight: 800; }
.reply p { margin: 8px 0 0; line-height: 1.6; }
.reply b { color: #0b1633; }
.empty { text-align: center; color: rgba(11,22,51,0.45); }
.composer {
  position: fixed; left: 0; right: 0; bottom: 0; padding: 10px 16px 20px;
  background: #fff; border-top: 1px solid rgba(11,22,51,0.06);
}
textarea {
  width: 100%; min-height: 64px; border: none; background: #f4f7fb; border-radius: 12px;
  padding: 10px 12px; resize: none;
}
.primary {
  margin-top: 8px; width: 100%; height: 42px; border: none; border-radius: 999px;
  color: #fff; font-weight: 700; background: linear-gradient(135deg, #2459ff, #52b7ff);
}
</style>
