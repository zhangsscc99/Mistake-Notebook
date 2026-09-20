<template>
  <div class="page">
    <van-nav-bar title="我的老师" left-arrow @click-left="$router.push('/profile')" fixed placeholder />

    <div class="card">
      <h3>加入班级</h3>
      <p class="hint">输入老师给的班级加入码。提交后需老师通过，才会进入班级、收到作业。</p>
      <div class="row">
        <input v-model="code" maxlength="8" placeholder="班级加入码" class="code-input" />
        <button class="primary slim" :disabled="binding" @click="bind">申请加入</button>
      </div>
    </div>

    <div class="card">
      <h3>加入机构</h3>
      <p class="hint">输入老师机构主页上的加入码。提交后需老师通过，才会进入该机构。</p>
      <div class="row">
        <input v-model="orgCode" maxlength="8" placeholder="机构加入码" class="code-input" />
        <button class="primary slim" :disabled="orgBinding" @click="bindOrg">申请加入</button>
      </div>
    </div>

    <div v-for="t in sum.teachers || []" :key="t.id" class="card teacher">
      <div class="t-head">
        <div class="avatar">{{ (t.nickName || 'T').slice(0, 1) }}</div>
        <div class="t-body">
          <b>{{ t.nickName }}</b>
          <span>{{ t.school || '' }} {{ t.className || '' }}</span>
        </div>
        <span v-if="t.unread > 0" class="badge">{{ t.unread }}</span>
      </div>
      <div class="t-actions">
        <button class="ghost" @click="openChat(t)">留言 / 查看消息</button>
        <button class="del" @click="unbind(t)">解绑</button>
      </div>
    </div>

    <div v-if="orgs.length" class="card">
      <h3>我的机构</h3>
      <div v-for="o in orgs" :key="o.id" class="cls">
        <div>
          <b>{{ o.name }}</b>
          <span>{{ o.teacherName || '教师' }} · {{ o.status === 'pending' ? '待老师审核' : '已加入' }}</span>
        </div>
        <em :class="o.status">{{ o.status === 'pending' ? '待审核' : '已通过' }}</em>
      </div>
    </div>

    <div v-if="(sum.classes || []).length" class="card">
      <h3>我的班级</h3>
      <div v-for="c in sum.classes" :key="c.id" class="cls">
        <div>
          <b>{{ c.name }}</b>
          <span>{{ c.teacherName || '教师' }} · {{ c.status === 'pending' ? '待老师审核' : '已加入' }}</span>
        </div>
        <em :class="c.status">{{ c.status === 'pending' ? '待审核' : '已通过' }}</em>
      </div>
    </div>

    <div v-if="!(sum.teachers || []).length && !(sum.classes || []).length && !orgs.length" class="empty">还没有加入班级或机构。把老师给的加入码填在上面。</div>

    <div class="entry-grid">
      <div class="entry" @click="$router.push('/class-notebooks')">
        <div class="entry-mark">册</div>
        <div class="entry-body">
          <b>班级错题本</b>
          <span>老师推送的高频错题，{{ (sum.notebooks || []).length }} 本</span>
        </div>
        <van-icon name="arrow" />
      </div>
      <div class="entry" @click="$router.push('/homework')">
        <div class="entry-mark">业</div>
        <div class="entry-body">
          <b>我的作业</b>
          <span>{{ todoCount }} 份待完成 · 共 {{ (sum.homework || []).length }} 份</span>
        </div>
        <van-icon name="arrow" />
      </div>
      <div class="entry" @click="$router.push('/parent-reports')">
        <div class="entry-mark">报</div>
        <div class="entry-body">
          <b>家长端报告</b>
          <span>老师生成的学习情况报告，{{ (sum.parentReports || []).length }} 份</span>
        </div>
        <van-icon name="arrow" />
      </div>
    </div>

    <!-- 留言 -->
    <van-popup v-model:show="chatOpen" position="bottom" round :style="{ height: '80%' }">
      <div class="chat-wrap">
        <div class="chat-head">
          <b>{{ activeTeacher?.nickName }}</b>
          <van-icon name="cross" @click="chatOpen = false" />
        </div>
        <div class="chat">
          <div v-if="!messages.length" class="empty">还没有消息。</div>
          <div v-for="m in messages" :key="m.id" class="msg" :class="m.senderRole === 'STUDENT' ? 'mine' : 'theirs'">
            <div class="bubble">{{ m.content }}</div>
            <span class="time">{{ fmt(m.createdAt) }}</span>
          </div>
        </div>
        <div class="composer">
          <input v-model="draft" placeholder="想问老师什么…" @keyup.enter="send" />
          <button class="primary slim" :disabled="sending || !draft.trim()" @click="send">发送</button>
        </div>
      </div>
    </van-popup>

    <AppTabBar />
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import classroomAPI from '../api/classroom'
import orgAPI from '../api/org'
import AppTabBar from '../components/AppTabBar.vue'

export default {
  name: 'ClassroomPage',
  components: { AppTabBar },
  setup() {
    const router = useRouter()
    const sum = ref({})
    const code = ref('')
    const binding = ref(false)
    const orgCode = ref('')
    const orgBinding = ref(false)
    const orgs = ref([])
    const chatOpen = ref(false)
    const activeTeacher = ref(null)
    const messages = ref([])
    const draft = ref('')
    const sending = ref(false)

    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || '操作失败' })
    const todoCount = computed(() => (sum.value.homework || []).filter((h) => h.status === 'TODO').length)

    const load = async () => {
      const res = await classroomAPI.summary()
      sum.value = res.data || {}
      try {
        const orgRes = await orgAPI.joined()
        orgs.value = orgRes.data || []
      } catch {
        orgs.value = []
      }
    }

    const bind = async () => {
      if (!code.value.trim()) {
        showToast('请输入邀请码')
        return
      }
      binding.value = true
      try {
        await classroomAPI.bindTeacher(code.value.trim())
        code.value = ''
        await load()
        showToast({ type: 'success', message: '已提交加入申请' })
      } catch (e) {
        fail(e)
      } finally {
        binding.value = false
      }
    }

    const bindOrg = async () => {
      if (!orgCode.value.trim()) {
        showToast('请输入机构加入码')
        return
      }
      orgBinding.value = true
      try {
        await orgAPI.join(orgCode.value.trim())
        orgCode.value = ''
        await load()
        showToast({ type: 'success', message: '已提交加入申请' })
      } catch (e) {
        fail(e)
      } finally {
        orgBinding.value = false
      }
    }

    const unbind = async (t) => {
      await showConfirmDialog({ title: '解绑老师', message: `解绑后不再收到 ${t.nickName} 的作业和错题本。` })
      await classroomAPI.unbindTeacher(t.id)
      await load()
    }

    const openChat = async (t) => {
      activeTeacher.value = t
      chatOpen.value = true
      try {
        const res = await classroomAPI.messages(t.id)
        messages.value = res.data || []
        await load()
      } catch (e) {
        fail(e)
      }
    }

    const send = async () => {
      if (!draft.value.trim() || !activeTeacher.value) return
      sending.value = true
      try {
        await classroomAPI.sendMessage(activeTeacher.value.id, draft.value.trim())
        draft.value = ''
        const res = await classroomAPI.messages(activeTeacher.value.id)
        messages.value = res.data || []
      } catch (e) {
        fail(e)
      } finally {
        sending.value = false
      }
    }

    const fmt = (t) => (t ? String(t).replace('T', ' ').slice(0, 16) : '')
    onMounted(() => load().catch(() => {}))
    return { sum, code, binding, orgCode, orgBinding, orgs, todoCount, chatOpen, activeTeacher, messages, draft, sending, bind, bindOrg, unbind, openChat, send, fmt, router }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 90px; background: #eef3fb; }
.card { background: #fff; margin: 12px 16px; padding: 16px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.card h3 { margin: 0 0 6px; font-size: 15px; }
.hint { margin: 0 0 12px; font-size: 12px; color: rgba(11,22,51,0.5); }
.row { display: flex; gap: 8px; }
.code-input { flex: 1; height: 42px; border: none; background: #f4f7fb; border-radius: 12px; padding: 0 14px; letter-spacing: 4px; font-weight: 700; text-transform: uppercase; min-width: 0; }
.primary { width: 100%; height: 42px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.primary.slim { width: auto; padding: 0 20px; height: 42px; flex-shrink: 0; }
.teacher .t-head { display: flex; align-items: center; gap: 12px; }
.avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.t-body { flex: 1; display: flex; flex-direction: column; }
.t-body b { font-size: 15px; }
.t-body span { font-size: 12px; color: rgba(11,22,51,0.5); }
.badge { background: #e11d48; color: #fff; border-radius: 999px; padding: 0 7px; font-size: 12px; }
.t-actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.ghost { border: none; background: #eef3fb; color: #2459ff; border-radius: 999px; padding: 8px 14px; font-weight: 700; }
.del { border: none; background: none; color: #e11d48; font-weight: 700; margin-left: auto; }
.empty { padding: 24px; text-align: center; color: rgba(11,22,51,0.5); font-size: 13px; }
.entry-grid { display: flex; flex-direction: column; gap: 10px; margin: 16px; }
.entry {
  background: #fff; border-radius: 16px; padding: 14px 16px;
  display: flex; align-items: center; gap: 12px;
  border: 1px solid rgba(11,22,51,0.06); cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
@media (hover: hover) and (pointer: fine) {
  .entry:hover {
    z-index: 2;
    transform: translateY(-4px);
    border-color: rgba(36, 89, 255, 0.32);
    box-shadow: 0 16px 32px rgba(31, 91, 255, 0.16);
  }
}
.entry-mark { width: 42px; height: 42px; border-radius: 12px; background: rgba(36,89,255,0.12); color: #2459ff; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.entry-body { flex: 1; display: flex; flex-direction: column; }
.entry-body b { font-size: 15px; color: #0b1633; }
.entry-body span { font-size: 12px; color: rgba(11,22,51,0.5); }
.cls { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-top: 1px solid rgba(11,22,51,0.06); }
.cls:first-of-type { border-top: none; }
.cls span { display: block; font-size: 12px; color: rgba(11,22,51,0.5); margin-top: 4px; }
.cls em { font-style: normal; font-size: 12px; font-weight: 700; }
.cls em.pending { color: #d97706; }
.cls em.approved { color: #16a34a; }
.chat-wrap { display: flex; flex-direction: column; height: 100%; }
.chat-head { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid rgba(11,22,51,0.06); }
.chat { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #eef3fb; }
.msg { display: flex; flex-direction: column; max-width: 78%; }
.msg.mine { align-self: flex-end; align-items: flex-end; }
.bubble { padding: 10px 12px; border-radius: 14px; background: #fff; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
.msg.mine .bubble { background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; }
.time { font-size: 11px; color: rgba(11,22,51,0.35); margin-top: 4px; }
.composer { display: flex; gap: 8px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid rgba(11,22,51,0.06); }
.composer input { flex: 1; height: 40px; border: none; background: #f4f7fb; border-radius: 999px; padding: 0 14px; min-width: 0; }
</style>
