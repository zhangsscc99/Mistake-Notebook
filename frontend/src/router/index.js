import { createRouter, createWebHistory } from 'vue-router'
import { isLoggedIn } from '../utils/auth'

const Camera = () => import(/* webpackChunkName: "page-home" */ '../views/Camera.vue')
const Categories = () => import(/* webpackChunkName: "page-categories" */ '../views/Categories.vue')
const CategoryDetail = () => import(/* webpackChunkName: "page-category-detail" */ '../views/CategoryDetail.vue')
const PaperBuilder = () => import(/* webpackChunkName: "page-paper-builder" */ '../views/PaperBuilder.vue')
const Settings = () => import(/* webpackChunkName: "page-settings" */ '../views/Settings.vue')
const QuestionSelector = () => import(/* webpackChunkName: "page-question-selector" */ '../views/QuestionSelector.vue')
const AiChat = () => import(/* webpackChunkName: "page-ai-chat" */ '../views/AiChat.vue')
const Analyzing = () => import(/* webpackChunkName: "page-analyzing" */ '../views/Analyzing.vue')
const Login = () => import(/* webpackChunkName: "page-login" */ '../views/Login.vue')
const Profile = () => import(/* webpackChunkName: "page-profile" */ '../views/Profile.vue')
const Leaderboard = () => import(/* webpackChunkName: "page-leaderboard" */ '../views/Leaderboard.vue')
const LearningReport = () => import(/* webpackChunkName: "page-learn" */ '../views/LearningReport.vue')
const LearningReportView = () => import(/* webpackChunkName: "page-learn-view" */ '../views/LearningReportView.vue')
const ReportList = () => import(/* webpackChunkName: "page-reports" */ '../views/ReportList.vue')
const MistakeReport = () => import(/* webpackChunkName: "page-mistake" */ '../views/MistakeReport.vue')
const Variants = () => import(/* webpackChunkName: "page-variants" */ '../views/Variants.vue')
const VariantList = () => import(/* webpackChunkName: "page-variant-list" */ '../views/VariantList.vue')

const routes = [
  { path: '/', redirect: '/homepage' },
  { path: '/login', name: 'Login', component: Login, meta: { title: '登录', public: true } },
  { path: '/homepage', name: 'Homepage', component: Camera, meta: { title: '首页', keepAlive: true } },
  { path: '/categories', name: 'Categories', component: Categories, meta: { title: '错题分类', keepAlive: true } },
  { path: '/category/:id', name: 'CategoryDetail', component: CategoryDetail, meta: { title: '分类详情' } },
  { path: '/paper-builder', name: 'PaperBuilder', component: PaperBuilder, meta: { title: '组合试卷' } },
  { path: '/settings', name: 'Settings', component: Settings, meta: { title: '设置' } },
  { path: '/question-selector', name: 'QuestionSelector', component: QuestionSelector, meta: { title: '选择题目' } },
  { path: '/ai-chat', name: 'AiChat', component: AiChat, meta: { title: 'AI 答疑' } },
  { path: '/analyzing', name: 'Analyzing', component: Analyzing, meta: { title: 'AI 解析进度' } },
  { path: '/profile', name: 'Profile', component: Profile, meta: { title: '我的' } },
  { path: '/leaderboard', name: 'Leaderboard', component: Leaderboard, meta: { title: '排行榜' } },
  { path: '/learning-report', name: 'LearningReport', component: LearningReport, meta: { title: '学习报告' } },
  { path: '/learning-report/:id', name: 'LearningReportView', component: LearningReportView, meta: { title: '学习报告' } },
  { path: '/report-list', name: 'ReportList', component: ReportList, meta: { title: '错因报告' } },
  { path: '/mistake-report/:id', name: 'MistakeReport', component: MistakeReport, meta: { title: '错因分析' } },
  { path: '/variants', name: 'Variants', component: Variants, meta: { title: '变式题' } },
  { path: '/variant-list', name: 'VariantList', component: VariantList, meta: { title: '已保存变式题' } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.meta.title) document.title = to.meta.title + ' - 智卷错题通'
  if (!to.meta.public && !isLoggedIn()) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }
  if (to.path === '/login' && isLoggedIn()) {
    next('/homepage')
    return
  }
  next()
})

export default router
