import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// 引入 Vant 组件库
import Vant from 'vant'
import 'vant/lib/index.css'

// 在桌面端使用 touch 模拟器
import '@vant/touch-emulator'

// 引入全局样式
import './styles/global.css'
import './styles/mobile-optimization.css'

const app = createApp(App)

// 错误处理
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue Error:', err)
  console.error('Component:', vm)
  console.error('Info:', info)
}

// 全局属性
app.config.globalProperties.$ELEMENT = {}

app.use(router)
app.use(Vant)

app.mount('#app')