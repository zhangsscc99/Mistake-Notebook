<template>
  <div class="page">
    <van-nav-bar title="互助答疑" left-arrow @click-left="$router.push('/community')" />

    <div class="card composer">
      <div class="kicker">把卡住的一步写清楚</div>
      <input v-model="form.title" maxlength="80" placeholder="标题，例如：顶点式常数项怎么移" />
      <select v-model="form.subject">
        <option value="">科目（选填）</option>
        <option>数学</option><option>英语</option><option>物理</option>
        <option>化学</option><option>语文</option><option>其他</option>
      </select>
      <textarea v-model="form.content" maxlength="800" placeholder="你已经试过什么，卡在哪一步"></textarea>
      <textarea v-if="form.snippet || form.questionId" v-model="form.snippet" maxlength="200" class="snippet" placeholder="原题摘录"></textarea>
      <p v-if="form.questionId" class="attach">已附带错题 #{{ form.questionId }}</p>
      <button class="primary" :disabled="posting" @click="publish">{{ posting ? '发布中…' : '发布求助' }}</button>
    </div>

    <div class="filters">
      <button v-for="s in subjects" :key="s || 'all'" :class="{ on: filter === s }" @click="setFilter(s)">{{ s || '全部' }}</button>
    </div>

    <article v-for="post in posts" :key="post.id" class="card post" @click="$router.push('/community/help/' + post.id)">
      <div class="meta">
        <em v-if="post.subject">{{ post.subject }}</em>
        <span>{{ post.nickName }} · {{ fmt(post.createdAt) }}</span>
      </div>
      <b>{{ post.title }}</b>
      <p>{{ post.preview }}</p>
      <i>{{ post.likeCount || 0 }} 赞 · {{ post.replyCount }} 条回复{{ post.seeded ? ' · 案例' : '' }}{{ post.questionId ? ' · 附带错题' : '' }}</i>
    </article>
    <p v-if="!posts.length && !loading" class="empty">还没有人提问。你来写第一条。</p>
  </div>
</template>

<script>
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import socialAPI from '../api/social'

export default {
  name: 'HelpBoard',
  setup() {
    const route = useRoute()
    const posts = ref([])
    const loading = ref(true)
    const posting = ref(false)
    const filter = ref('')
    const subjects = ['', '数学', '英语', '物理', '化学', '语文', '其他']
    const form = reactive({
      title: String(route.query.title || ''),
      subject: '',
      content: '',
      snippet: String(route.query.snippet || ''),
      questionId: route.query.questionId ? Number(route.query.questionId) : null
    })

    const load = async () => {
      loading.value = true
      try {
        const res = await socialAPI.listHelp(filter.value)
        posts.value = res.data || []
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })
      } finally {
        loading.value = false
      }
    }

    const setFilter = (s) => {
      filter.value = s
      load()
    }

    const publish = async () => {
      posting.value = true
      try {
        const payload = { ...form }
        if (!payload.questionId) delete payload.questionId
        await socialAPI.createHelp(payload)
        form.title = ''
        form.content = ''
        form.snippet = ''
        form.questionId = null
        showToast({ type: 'success', message: '已发布' })
        await load()
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '发布失败' })
      } finally {
        posting.value = false
      }
    }

    onMounted(load)
    const fmt = (t) => (t ? String(t).replace('T', ' ').slice(0, 16) : '')
    return { posts, loading, posting, form, publish, subjects, filter, setFilter, fmt }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40px; background: #eef3fb; }
.card {
  background: #fff; margin: 12px 16px; padding: 14px; border-radius: 16px;
  border: 1px solid rgba(11,22,51,0.06);
}
.kicker { font-size: 12px; color: #2459ff; font-weight: 700; margin-bottom: 8px; }
input, select, textarea {
  width: 100%; border: none; background: #f4f7fb; border-radius: 12px;
  padding: 10px 12px; margin-bottom: 8px; font-size: 14px; color: #0b1633;
}
textarea { min-height: 88px; resize: none; }
.snippet { min-height: 56px; }
.attach { margin: 0 0 8px; font-size: 12px; color: #2459ff; }
.primary {
  width: 100%; height: 42px; border: none; border-radius: 999px; color: #fff; font-weight: 700;
  background: linear-gradient(135deg, #2459ff, #52b7ff);
}
.primary:disabled { opacity: 0.45; }
.filters { display: flex; gap: 8px; padding: 0 16px; overflow: auto; }
.filters button {
  flex: none; height: 30px; padding: 0 12px; border-radius: 999px; border: none;
  background: #fff; color: rgba(11,22,51,0.55); font-size: 12px; font-weight: 700;
}
.filters button.on { background: #2459ff; color: #fff; }
.post {
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
@media (hover: hover) and (pointer: fine) {
  article.post:hover {
    transform: translateY(-4px);
    border-color: rgba(36, 89, 255, 0.32);
    box-shadow: 0 16px 32px rgba(31, 91, 255, 0.16);
  }
}
.post .meta { display: flex; justify-content: space-between; font-size: 12px; color: rgba(11,22,51,0.45); }
.post em { font-style: normal; color: #2459ff; font-weight: 700; }
.post b { display: block; margin: 8px 0 4px; }
.post p { margin: 0; font-size: 13px; color: rgba(11,22,51,0.65); }
.post i { display: block; margin-top: 8px; font-style: normal; font-size: 12px; color: rgba(11,22,51,0.4); }
.empty { text-align: center; color: rgba(11,22,51,0.45); padding: 24px; }
</style>
