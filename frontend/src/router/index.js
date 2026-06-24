import { createRouter, createWebHistory } from 'vue-router'

// 页面组件
import Camera from '../views/Camera.vue'
import Categories from '../views/Categories.vue'
import CategoryDetail from '../views/CategoryDetail.vue'
import PaperBuilder from '../views/PaperBuilder.vue'
import Settings from '../views/Settings.vue'
import QuestionSelector from '../views/QuestionSelector.vue'
import AiChat from '../views/AiChat.vue'
import Analyzing from '../views/Analyzing.vue'

const routes = [  
  {
    path: '/',
    redirect: '/homepage'
  },
  {
    path: '/homepage',
    name: 'Homepage',
    component: Camera,
    meta: {
      title: '错题本整理 - 首页',
      keepAlive: true
    }
  },
  {
    path: '/categories',
    name: 'Categories',
    component: Categories,
    meta: {
      title: '错题分类',
      keepAlive: true
    }
  },
  {
    path: '/category/:id',
    name: 'CategoryDetail',
    component: CategoryDetail,
    meta: {
      title: '分类详情'
    }
  },
  {
    path: '/paper-builder',
    name: 'PaperBuilder',
    component: PaperBuilder,
    meta: {
      title: '组合试卷'
    }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
    meta: {
      title: '设置'
    }
  },
  {
    path: '/question-selector',
    name: 'QuestionSelector',
    component: QuestionSelector,
    meta: {
      title: '选择题目'
    }
  },
  {
    path: '/ai-chat',
    name: 'AiChat',
    component: AiChat,
    meta: {
      title: 'AI 答疑'
    }
  },
  {
    path: '/analyzing',
    name: 'Analyzing',
    component: Analyzing,
    meta: {
      title: 'AI 解析进度'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫 - 设置页面标题
router.beforeEach((to, from, next) => {
  if (to.meta.title) {
    document.title = to.meta.title + ' - 错题本整理'
  }
  next()
})

export default router