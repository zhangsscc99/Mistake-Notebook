<template>
  <div class="login-page">
    <div class="hero">
      <div class="mark">错</div>
      <div class="title">智卷错题通</div>
      <div class="subtitle">网页端用账号进入，每人一份自己的错题本</div>
    </div>

    <div class="card">
      <div class="card-title">{{ mode === 'login' ? '欢迎回来' : '创建账号' }}</div>
      <div class="card-desc">
        {{ mode === 'login' ? '用你的账号密码进入原来的错题本' : '第一次使用会创建账号，之后换设备也能找回' }}
      </div>

      <label class="field">
        <span>账号</span>
        <input v-model="username" maxlength="40" placeholder="2–40 个字符" />
      </label>
      <label class="field">
        <span>密码</span>
        <input v-model="password" type="password" maxlength="40" placeholder="至少 4 位" />
      </label>
      <label v-if="mode === 'register'" class="field">
        <span>昵称</span>
        <input v-model="nickName" maxlength="20" placeholder="匿名用户" />
      </label>

      <button class="login-btn" :disabled="submitting" @click="submit">
        {{ submitting ? '正在进入…' : (mode === 'login' ? '进入错题本' : '创建并登录') }}
      </button>
      <button class="switch-btn" @click="mode = mode === 'login' ? 'register' : 'login'">
        {{ mode === 'login' ? '没有账号？去创建' : '已有账号？去登录' }}
      </button>
    </div>
    <p class="hint">网页端没有微信一键登录，功能和隔离规则与小程序一致。</p>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import userAPI from '../api/user'
import { setSession } from '../utils/auth'

export default {
  name: 'LoginPage',
  setup() {
    const router = useRouter()
    const mode = ref('login')
    const username = ref('')
    const password = ref('')
    const nickName = ref('匿名用户')
    const submitting = ref(false)

    const submit = async () => {
      if (submitting.value) return
      submitting.value = true
      try {
        const fn = mode.value === 'login' ? userAPI.login : userAPI.register
        const res = await fn({
          username: username.value,
          password: password.value,
          nickName: nickName.value
        })
        if (!res.success) throw new Error(res.message || '失败')
        setSession(res.data.token, res.data)
        showToast({ type: 'success', message: res.message || '欢迎回来' })
        router.replace('/homepage')
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || e.message || '登录失败' })
      } finally {
        submitting.value = false
      }
    }

    return { mode, username, password, nickName, submitting, submit }
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  padding: 48px 20px 40px;
  background-color: #eef3fb;
  background-image:
    radial-gradient(circle 420px at 100% 0%, rgba(82,183,255,0.12) 0%, transparent 60%),
    linear-gradient(rgba(11,22,51,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(11,22,51,0.025) 1px, transparent 1px);
  background-size: auto, 44px 44px, 44px 44px;
}
.hero { text-align: center; margin-bottom: 28px; }
.mark {
  width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 16px;
  background: linear-gradient(135deg, #2459ff, #52b7ff);
  color: #fff; font-size: 22px; font-weight: 800; line-height: 56px;
}
.title { font-size: 24px; font-weight: 800; color: #0b1633; }
.subtitle { margin-top: 8px; color: rgba(11,22,51,0.5); font-size: 13px; }
.card {
  background: #fff; border-radius: 20px; padding: 22px 18px 18px;
  border: 1px solid rgba(11,22,51,0.06); box-shadow: 0 12px 36px rgba(11,22,51,0.06);
}
.card-title { font-size: 18px; font-weight: 800; color: #0b1633; }
.card-desc { margin: 6px 0 18px; color: rgba(11,22,51,0.5); font-size: 13px; }
.field { display: block; margin-bottom: 12px; }
.field span { display: block; font-size: 12px; color: rgba(11,22,51,0.5); margin-bottom: 6px; }
.field input {
  width: 100%; height: 44px; border: none; border-radius: 12px;
  background: #f4f7fb; padding: 0 12px; font-size: 15px; color: #0b1633;
}
.login-btn {
  margin-top: 8px; width: 100%; height: 46px; border: none; border-radius: 999px;
  color: #fff; font-weight: 700; font-size: 16px;
  background: linear-gradient(135deg, #2459ff, #52b7ff);
  box-shadow: 0 10px 24px rgba(31,91,255,0.30);
}
.switch-btn {
  margin-top: 10px; width: 100%; height: 40px; border: none; background: transparent;
  color: #2459ff; font-weight: 600;
}
.hint { text-align: center; margin-top: 18px; color: rgba(11,22,51,0.4); font-size: 12px; }
</style>
