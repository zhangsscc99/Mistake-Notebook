import { createRouter, createWebHistory } from 'vue-router'

const Camera = () => import(/* webpackChunkName: "page-home" */ '../views/Camera.vue')
const Categories = () => import(/* webpackChunkName: "page-categories" */ '../views/Categories.vue')
const CategoryDetail = () => import(/* webpackChunkName: "page-category-detail" */ '../views/CategoryDetail.vue')
const PaperBuilder = () => import(/* webpackChunkName: "page-paper-builder" */ '../views/PaperBuilder.vue')
const Settings = () => import(/* webpackChunkName: "page-settings" */ '../views/Settings.vue')
const QuestionSelector = () => import(/* webpackChunkName: "page-question-selector" */ '../views/QuestionSelector.vue')
const AiChat = () => import(/* webpackChunkName: "page-ai-chat" */ '../views/AiChat.vue')
const Analyzing = () => import(/* webpackChunkName: "page-analyzing" */ '../views/Analyzing.vue')

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
