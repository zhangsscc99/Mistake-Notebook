<template>
  <div class="page">
    <van-nav-bar title="好友 PK" left-arrow @click-left="$router.push('/community')" />

    <div class="card power">
      <div>
        <div class="kicker">我的战力</div>
        <b>{{ data.myPower?.score || 0 }}</b>
      </div>
      <ul>
        <li>连续打卡 {{ data.myPower?.streak || 0 }}</li>
        <li>错题 {{ data.myPower?.questions || 0 }}</li>
        <li>已掌握 {{ data.myPower?.mastered || 0 }}</li>
      </ul>
    </div>

    <div class="card">
      <div class="kicker">加好友</div>
      <div class="row">
        <input v-model="username" maxlength="40" placeholder="输入对方账号" />
        <button class="ghost" :disabled="adding" @click="add">添加</button>
      </div>
      <div class="row">
        <input v-model="query" maxlength="40" placeholder="搜索账号或昵称" @keyup.enter="search" />
        <button class="ghost" @click="search">搜索</button>
      </div>
      <div v-for="u in found" :key="u.id" class="person">
        <div>
          <b>{{ u.nickName }}</b>
          <span>账号 {{ u.username }}</span>
        </div>
        <button v-if="u.relation === 'NONE'" class="mini" @click="addName(u.username)">加好友</button>
        <span v-else class="hint">{{ relationText(u.relation) }}</span>
      </div>
    </div>

    <div v-if="(data.incoming || []).length" class="card">
      <div class="kicker">待处理申请</div>
      <div v-for="u in data.incoming" :key="u.id" class="person">
        <div><b>{{ u.nickName }}</b><span>{{ u.username }}</span></div>
        <div class="btns">
          <button class="mini" @click="reject(u.id)">拒绝</button>
          <button class="mini fill" @click="accept(u.id)">通过</button>
        </div>
      </div>
    </div>

    <div v-if="(data.outgoing || []).length" class="card">
      <div class="kicker">已发出申请</div>
      <div v-for="u in data.outgoing" :key="u.id" class="person">
        <div><b>{{ u.nickName }}</b><span>{{ u.username }}</span></div>
        <button class="mini" @click="cancel(u.id)">撤回</button>
      </div>
    </div>

    <div v-if="(data.pendingPk || []).length" class="card">
      <div class="kicker">待应战</div>
      <div v-for="m in data.pendingPk" :key="m.id" class="person">
        <div>
          <b>{{ m.challenger?.nickName }} 向你发起 {{ m.mode === 'QUIZ' ? '答题 PK' : '战力 PK' }}</b>
          <span>{{ m.createdAt }}{{ m.questionCount ? ' · ' + m.questionCount + ' 题' : '' }}</span>
        </div>
        <button class="mini fill" @click="fight(m)">应战</button>
      </div>
    </div>

    <div class="section-head">好友</div>
    <div v-for="f in data.friends || []" :key="f.id" class="card person">
      <div>
        <b>{{ f.nickName }}</b>
        <span>{{ f.username }}{{ f.stage ? ' · ' + f.stage : '' }}</span>
      </div>
      <div class="btns">
        <button class="mini" @click="remove(f)">解除</button>
        <button class="mini fill" @click="pk(f.id)">发起 PK</button>
      </div>
    </div>
    <p v-if="!(data.friends || []).length" class="empty">还没有好友。用对方账号添加后即可 PK。</p>

    <div class="section-head">对战记录</div>
    <article v-for="m in data.matches || []" :key="m.id" class="card match" @click="openMatch(m)">
      <div class="vs">
        <span>{{ m.challenger?.nickName }}</span>
        <em>{{ scoreOf(m) }}</em>
        <span>{{ m.opponent?.nickName }}</span>
      </div>
      <p>{{ m.result }} · {{ m.mode === 'QUIZ' ? '答题' : '战力' }} · {{ m.createdAt }}</p>
    </article>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import socialAPI from '../api/social'

export default {
  name: 'FriendsPk',
  setup() {
    const router = useRouter()
    const data = ref({})
    const username = ref('')
    const query = ref('')
    const found = ref([])
    const adding = ref(false)

    const apply = (res) => { data.value = res.data || {} }

    const load = async () => {
      try {
        apply(await socialAPI.friends())
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })
      }
    }

    const add = async () => {
      adding.value = true
      try {
        apply(await socialAPI.addFriend(username.value))
        username.value = ''
        showToast({ type: 'success', message: '已处理' })
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '添加失败' })
      } finally {
        adding.value = false
      }
    }

    const addName = async (name) => {
      try {
        apply(await socialAPI.addFriend(name))
        showToast({ type: 'success', message: '已发送申请' })
        found.value = found.value.map((u) => u.username === name ? { ...u, relation: 'OUTGOING' } : u)
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '添加失败' })
      }
    }

    const search = async () => {
      try {
        const res = await socialAPI.searchUsers(query.value)
        found.value = res.data || []
        if (!found.value.length) showToast('没有匹配的同学')
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '搜索失败' })
      }
    }

    const accept = async (id) => {
      try {
        apply(await socialAPI.acceptFriend(id))
        showToast({ type: 'success', message: '已通过' })
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '失败' })
      }
    }

    const reject = async (id) => {
      try {
        apply(await socialAPI.rejectFriend(id))
        showToast({ type: 'success', message: '已拒绝' })
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '失败' })
      }
    }

    const cancel = async (id) => {
      try {
        apply(await socialAPI.cancelFriend(id))
        showToast({ type: 'success', message: '已撤回' })
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '失败' })
      }
    }

    const remove = async (f) => {
      await showConfirmDialog({ title: '解除好友', message: '确定与 ' + (f.nickName || f.username) + ' 解除好友？' })
      try {
        apply(await socialAPI.unfriend(f.id))
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '失败' })
      }
    }

    const pk = async (friendId) => {
      try {
        const res = await socialAPI.challenge(friendId)
        apply(res)
        const last = res.data?.lastMatch
        showToast({ type: 'success', message: last?.mode === 'QUIZ' ? '已发出答题 PK' : '已发出战力 PK' })
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '无法 PK' })
      }
    }

    const fight = async (m) => {
      if (m.mode === 'QUIZ') {
        router.push('/community/pk/' + m.id)
        return
      }
      try {
        const res = await socialAPI.acceptPk(m.id)
        apply(res)
        const last = res.data?.lastMatch
        showToast({ type: 'success', message: last?.result || '已结算' })
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '应战失败' })
      }
    }

    const openMatch = (m) => {
      if (m.playable || m.mode === 'QUIZ') router.push('/community/pk/' + m.id)
    }

    const scoreOf = (m) => {
      if (m.status === 'DONE') return (m.challengerScore || 0) + ' : ' + (m.opponentScore || 0)
      if (m.status === 'ACTIVE') return '答题中'
      return '待应战'
    }

    const relationText = (r) => ({ FRIEND: '已是好友', OUTGOING: '已申请', INCOMING: '待你通过' }[r] || '')

    onMounted(load)
    return {
      data, username, query, found, adding, add, addName, search,
      accept, reject, cancel, remove, pk, fight, openMatch, scoreOf, relationText
    }
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
.power { display: flex; justify-content: space-between; align-items: center; }
.power b { font-size: 28px; color: #0b1633; }
.power ul { margin: 0; padding: 0; list-style: none; font-size: 12px; color: rgba(11,22,51,0.55); line-height: 1.8; }
.row { display: flex; gap: 8px; margin-bottom: 8px; }
input {
  flex: 1; height: 40px; border: none; background: #f4f7fb; border-radius: 12px; padding: 0 12px;
}
.ghost, .mini {
  height: 40px; padding: 0 14px; border-radius: 999px; border: none;
  background: rgba(36,89,255,0.12); color: #2459ff; font-weight: 700;
}
.mini { height: 32px; font-size: 12px; }
.mini.fill { background: linear-gradient(135deg, #2459ff, #52b7ff); color: #fff; }
.btns { display: flex; gap: 6px; flex-shrink: 0; }
.person { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 0; }
.person b { display: block; color: #0b1633; }
.person span, .hint { font-size: 12px; color: rgba(11,22,51,0.45); }
.section-head { margin: 16px 18px 0; font-weight: 800; }
.empty { text-align: center; color: rgba(11,22,51,0.45); padding: 8px 16px 16px; }
.match {
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
@media (hover: hover) and (pointer: fine) {
  article.match:hover {
    transform: translateY(-4px);
    border-color: rgba(36, 89, 255, 0.32);
    box-shadow: 0 16px 32px rgba(31, 91, 255, 0.16);
  }
}
.match .vs { display: flex; justify-content: space-between; align-items: center; font-weight: 700; }
.match em { font-style: normal; color: #2459ff; }
.match p { margin: 6px 0 0; font-size: 12px; color: rgba(11,22,51,0.45); }
</style>
