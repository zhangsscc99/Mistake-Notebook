<template>
  <div class="ai-chat-page">
    <van-nav-bar title="AI 答疑" left-arrow @click-left="goBack" fixed placeholder />

    <div v-if="questionContext" class="context-bar" @click="contextVisible = true">
      <div class="context-icon">题</div>
      <div class="context-body">
        <span class="context-label">正在答疑</span>
        <span class="context-text">{{ questionPreview }}</span>
      </div>
      <span class="context-chevron">查看</span>
    </div>

    <div
      v-if="questionContext && contextVisible"
      class="context-modal show"
      @click.self="contextVisible = false"
    >
      <div class="context-modal-card">
        <div class="modal-card-header">
          <div class="modal-card-badge">题</div>
          <span class="modal-card-title">题目详情</span>
          <span class="modal-card-close" @click="contextVisible = false">✕</span>
        </div>
        <div class="modal-card-scroll">
          <div
            v-for="(para, idx) in questionParas"
            :key="idx"
            class="q-para"
            :class="para.sub ? 'q-para-sub' : 'q-para-stem'"
          >
            <span v-if="para.sub" class="q-para-label">（{{ para.label }}）</span>
            <span class="q-para-text">{{ para.text }}</span>
          </div>
        </div>
      </div>
    </div>

    <div ref="msgScrollRef" class="msg-scroll">
      <div class="msg-list">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="msg-row"
          :class="msg.role === 'user' ? 'msg-row-user' : 'msg-row-ai'"
        >
          <div v-if="msg.role === 'assistant'" class="msg-avatar msg-avatar-ai">AI</div>
          <div class="msg-bubble" :class="msg.role === 'user' ? 'bubble-user' : 'bubble-ai'">
            <div v-if="msg.typing" class="typing">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            </div>
            <span v-else class="msg-text">{{ msg.display || msg.content }}</span>
          </div>
          <div v-if="msg.role === 'user'" class="msg-avatar msg-avatar-user">我</div>
        </div>
      </div>
    </div>

    <div class="input-bar">
      <input
        v-model="inputValue"
        class="chat-input"
        placeholder="输入你的问题…"
        :disabled="sending"
        @keyup.enter="sendMessage"
      />
      <button
        class="send-btn"
        :class="{ 'send-btn-active': inputValue.trim() && !sending }"
        :disabled="!inputValue.trim() || sending"
        @click="sendMessage"
      >
        发送
      </button>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import answerAPI from '../api/answer'
import { formatLatex } from '../utils/latex'
import { parseQuestionParas } from '../utils/questionFormat'

function buildGreeting(ctxRaw, memoryStatus) {
  if (memoryStatus?.hasMemory) {
    const questions = memoryStatus.lastQuestions
    if (questions?.length) {
      const lastQ = questions[questions.length - 1]
      if (ctxRaw) {
        return `你好，你上次问过「${lastQ}」，关于这道题，有什么不懂的地方都可以问我～`
      }
      return `你好，你上次问过「${lastQ}」，今天继续学吧～`
    }
    if (memoryStatus.topics?.length) {
      const topicHint = memoryStatus.topics.slice(0, 4).join('、')
      if (ctxRaw) {
        return `你好，我记得你之前学过 ${topicHint} 等内容。关于这道题，有什么不懂的地方都可以问我～`
      }
      return `你好，我记得你之前学过 ${topicHint} 等内容，继续把疑问发给我吧～`
    }
  }
  if (ctxRaw) {
    return '你好，我是你的 AI 答疑老师。关于这道题，有什么不懂的地方都可以问我～'
  }
  return '你好，我是你的 AI 答疑老师。把你的疑问发给我吧～'
}

export default {
  name: 'AiChat',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const msgScrollRef = ref(null)

    const questionContextRaw = ref('')
    const questionContext = ref('')
    const questionPreview = ref('')
    const questionParas = ref([])
    const contextVisible = ref(false)
    const messages = reactive([])
    const inputValue = ref('')
    const sending = ref(false)
    let sessionSaved = false

    const scrollToBottom = () => {
      nextTick(() => {
        const el = msgScrollRef.value
        if (el) el.scrollTop = el.scrollHeight
      })
    }

    const getApiMessages = () =>
      messages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
        .map(m => ({ role: m.role, content: m.content }))

    const persistSessionMemory = () => {
      if (sessionSaved) return
      const apiMessages = getApiMessages()
      if (!apiMessages.filter(m => m.role === 'user').length) return
      sessionSaved = true
      answerAPI.persistSessionMemory(apiMessages, questionContextRaw.value)
    }

    const goBack = () => router.back()

    const sendMessage = async () => {
      const text = (inputValue.value || '').trim()
      if (!text || sending.value) return

      const userId = 'u' + Date.now()
      messages.push({ id: userId, role: 'user', content: text, display: formatLatex(text) })

      const typingId = 't' + Date.now()
      messages.push({ id: typingId, role: 'assistant', content: '', display: '', typing: true })

      inputValue.value = ''
      sending.value = true
      scrollToBottom()

      const apiMessages = getApiMessages()
      try {
        const result = await answerAPI.chat(apiMessages, questionContextRaw.value)
        const reply = result.reply || '抱歉，我这边出了点问题，请稍后再试。'
        replaceTyping(typingId, reply)
      } catch {
        replaceTyping(typingId, '网络好像不太顺畅，请稍后再问我一次。')
      }
    }

    const replaceTyping = (typingId, reply) => {
      const idx = messages.findIndex(m => m.id === typingId)
      if (idx >= 0) {
        messages[idx] = {
          id: typingId,
          role: 'assistant',
          content: reply,
          display: formatLatex(reply)
        }
      }
      sending.value = false
      scrollToBottom()
    }

    onMounted(async () => {
      const ctxRaw = route.query.context ? decodeURIComponent(route.query.context) : ''
      questionContextRaw.value = ctxRaw
      questionContext.value = formatLatex(ctxRaw)
      questionPreview.value =
        questionContext.value.length > 50
          ? questionContext.value.slice(0, 50) + '…'
          : questionContext.value
      questionParas.value = parseQuestionParas(questionContext.value)
      if (!questionParas.value.length && questionContext.value) {
        questionParas.value = [{ label: '', text: questionContext.value, sub: false }]
      }

      const defaultGreeting = buildGreeting(ctxRaw, null)
      messages.push({ id: 'm0', role: 'assistant', content: defaultGreeting, display: defaultGreeting })
      scrollToBottom()

      const memory = await answerAPI.getMemoryStatus()
      if (memory && memory.hasMemory) {
        const greeting = buildGreeting(ctxRaw, memory)
        const idx = messages.findIndex(m => m.id === 'm0')
        if (idx >= 0) {
          messages[idx] = { id: 'm0', role: 'assistant', content: greeting, display: greeting }
        }
      }
    })

    onBeforeUnmount(() => {
      persistSessionMemory()
    })

    return {
      msgScrollRef,
      questionContext,
      questionPreview,
      questionParas,
      contextVisible,
      messages,
      inputValue,
      sending,
      goBack,
      sendMessage
    }
  }
}
</script>

<style scoped>
.ai-chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #eef3fb;
}

.context-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 16px 0;
  padding: 12px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid rgba(11, 22, 51, 0.06);
  box-shadow: 0 6px 18px rgba(11, 22, 51, 0.06);
  cursor: pointer;
}

.context-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  flex-shrink: 0;
  background: linear-gradient(140deg, #2459ff, #52b7ff, #b6a6ff);
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.context-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.context-label {
  font-size: 12px;
  color: #2459ff;
  font-weight: 700;
}

.context-text {
  font-size: 13px;
  color: rgba(11, 22, 51, 0.6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-chevron {
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  padding: 4px 12px;
  background: linear-gradient(135deg, #2459ff, #52b7ff);
  border-radius: 999px;
}

.context-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  background: rgba(11, 22, 51, 0.45);
}

.context-modal-card {
  width: 100%;
  max-width: 480px;
  max-height: 70vh;
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid rgba(11, 22, 51, 0.06);
}

.modal-card-badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #2459ff, #52b7ff);
  color: #fff;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-card-title {
  flex: 1;
  font-weight: 700;
  color: #0b1633;
}

.modal-card-close {
  font-size: 20px;
  color: rgba(11, 22, 51, 0.4);
  cursor: pointer;
}

.modal-card-scroll {
  padding: 16px;
  overflow-y: auto;
}

.q-para {
  margin-bottom: 12px;
  line-height: 1.6;
  color: #0b1633;
}

.q-para-label {
  font-weight: 700;
  margin-right: 4px;
}

.msg-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.msg-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 16px;
}

.msg-row-user {
  flex-direction: row-reverse;
}

.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.msg-avatar-ai {
  background: linear-gradient(135deg, #2459ff, #52b7ff);
  color: #fff;
}

.msg-avatar-user {
  background: #e8ecf4;
  color: #0b1633;
}

.msg-bubble {
  max-width: 75%;
  padding: 12px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble-ai {
  background: #fff;
  color: #0b1633;
  border: 1px solid rgba(11, 22, 51, 0.06);
  border-bottom-left-radius: 4px;
}

.bubble-user {
  background: linear-gradient(135deg, #2459ff, #1742d6);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.typing {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(11, 22, 51, 0.3);
  animation: bounce 1.2s infinite;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-4px); }
}

.input-bar {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid rgba(11, 22, 51, 0.06);
}

.chat-input {
  flex: 1;
  border: 1px solid rgba(11, 22, 51, 0.12);
  border-radius: 20px;
  padding: 10px 16px;
  font-size: 14px;
  outline: none;
}

.send-btn {
  border: none;
  border-radius: 20px;
  padding: 0 18px;
  font-size: 14px;
  font-weight: 600;
  background: rgba(11, 22, 51, 0.08);
  color: rgba(11, 22, 51, 0.35);
}

.send-btn-active {
  background: linear-gradient(135deg, #2459ff, #52b7ff);
  color: #fff;
}
</style>
