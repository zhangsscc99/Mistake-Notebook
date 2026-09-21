import { createRouter, createWebHistory } from 'vue-router'
import { isLoggedIn, isTeacher } from '../utils/auth'

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
const Practice = () => import(/* webpackChunkName: "page-practice" */ '../views/Practice.vue')
const QuestionExplain = () => import(/* webpackChunkName: "page-explain" */ '../views/QuestionExplain.vue')
const Classroom = () => import(/* webpackChunkName: "page-classroom" */ '../views/Classroom.vue')
const ClassNotebooks = () => import(/* webpackChunkName: "page-class-notebooks" */ '../views/ClassNotebooks.vue')
const ClassNotebookPractice = () => import(/* webpackChunkName: "page-class-practice" */ '../views/ClassNotebookPractice.vue')
const StudentHomework = () => import(/* webpackChunkName: "page-homework" */ '../views/StudentHomework.vue')
const StudentHomeworkDetail = () => import(/* webpackChunkName: "page-homework-detail" */ '../views/StudentHomeworkDetail.vue')
const ParentReports = () => import(/* webpackChunkName: "page-parent-reports" */ '../views/ParentReports.vue')
const CheckinPlaza = () => import(/* webpackChunkName: "page-plaza" */ '../views/CheckinPlaza.vue')
const Community = () => import(/* webpackChunkName: "page-community" */ '../views/Community.vue')
const HelpBoard = () => import(/* webpackChunkName: "page-help" */ '../views/HelpBoard.vue')
const HelpDetail = () => import(/* webpackChunkName: "page-help-detail" */ '../views/HelpDetail.vue')
const FriendsPk = () => import(/* webpackChunkName: "page-pk" */ '../views/FriendsPk.vue')
const PkPlay = () => import(/* webpackChunkName: "page-pk-play" */ '../views/PkPlay.vue')
const OrgCases = () => import(/* webpackChunkName: "page-orgs" */ '../views/OrgCases.vue')
const OrgCaseDetail = () => import(/* webpackChunkName: "page-org-detail" */ '../views/OrgCaseDetail.vue')
const OrgMemberBank = () => import(/* webpackChunkName: "page-org-bank" */ '../views/OrgMemberBank.vue')
const OrgBankPractice = () => import(/* webpackChunkName: "page-org-practice" */ '../views/OrgBankPractice.vue')

// 教师后台
const TeacherHome = () => import(/* webpackChunkName: "teacher-home" */ '../views/teacher/TeacherHome.vue')
const TeacherStudents = () => import(/* webpackChunkName: "teacher-students" */ '../views/teacher/TeacherStudents.vue')
const TeacherStudentDetail = () => import(/* webpackChunkName: "teacher-student-detail" */ '../views/teacher/TeacherStudentDetail.vue')
const TeacherClassNotebooks = () => import(/* webpackChunkName: "teacher-notebooks" */ '../views/teacher/TeacherClassNotebooks.vue')
const TeacherNotebookDetail = () => import(/* webpackChunkName: "teacher-notebook-detail" */ '../views/teacher/TeacherNotebookDetail.vue')
const TeacherHomework = () => import(/* webpackChunkName: "teacher-homework" */ '../views/teacher/TeacherHomework.vue')
const TeacherHomeworkDetail = () => import(/* webpackChunkName: "teacher-homework-detail" */ '../views/teacher/TeacherHomeworkDetail.vue')
const TeacherAnalytics = () => import(/* webpackChunkName: "teacher-analytics" */ '../views/teacher/TeacherAnalytics.vue')
const TeacherParentReport = () => import(/* webpackChunkName: "teacher-parent-report" */ '../views/teacher/TeacherParentReport.vue')
const TeacherQuestions = () => import(/* webpackChunkName: "teacher-questions" */ '../views/teacher/TeacherQuestions.vue')
const TeacherCapture = () => import(/* webpackChunkName: "teacher-capture" */ '../views/teacher/TeacherCapture.vue')
const TeacherBankPicker = () => import(/* webpackChunkName: "teacher-bank-picker" */ '../views/teacher/TeacherBankPicker.vue')
const TeacherSetDetail = () => import(/* webpackChunkName: "teacher-set-detail" */ '../views/teacher/TeacherSetDetail.vue')
const TeacherAssistant = () => import(/* webpackChunkName: "teacher-assistant" */ '../views/teacher/TeacherAssistant.vue')
const TeacherPaperHub = () => import(/* webpackChunkName: "teacher-paper" */ '../views/teacher/TeacherPaperHub.vue')
const TeacherSend = () => import(/* webpackChunkName: "teacher-send" */ '../views/teacher/TeacherSend.vue')
const TeacherMine = () => import(/* webpackChunkName: "teacher-mine" */ '../views/teacher/TeacherMine.vue')
const TeacherOrg = () => import(/* webpackChunkName: "teacher-org" */ '../views/teacher/TeacherOrg.vue')
const TeacherClassReport = () => import(/* webpackChunkName: "teacher-class-report" */ '../views/teacher/TeacherClassReport.vue')

const routes = [
  { path: '/', redirect: '/homepage' },
  { path: '/login', name: 'Login', component: Login, meta: { title: '登录', public: true } },
  { path: '/homepage', name: 'Homepage', component: Camera, meta: { title: '首页', keepAlive: true, student: true } },
  { path: '/categories', name: 'Categories', component: Categories, meta: { title: '错题分类', keepAlive: true, student: true } },
  { path: '/category/:id', name: 'CategoryDetail', component: CategoryDetail, meta: { title: '分类详情', student: true } },
  { path: '/paper-builder', name: 'PaperBuilder', component: PaperBuilder, meta: { title: '组合试卷', student: true } },
  { path: '/settings', name: 'Settings', component: Settings, meta: { title: '设置' } },
  { path: '/question-selector', name: 'QuestionSelector', component: QuestionSelector, meta: { title: '选择题目', student: true } },
  { path: '/ai-chat', name: 'AiChat', component: AiChat, meta: { title: 'AI 答疑', student: true } },
  { path: '/analyzing', name: 'Analyzing', component: Analyzing, meta: { title: 'AI 解析进度', student: true } },
  { path: '/profile', name: 'Profile', component: Profile, meta: { title: '我的' } },
  { path: '/leaderboard', name: 'Leaderboard', component: Leaderboard, meta: { title: '排行榜' } },
  { path: '/learning-report', name: 'LearningReport', component: LearningReport, meta: { title: '学习报告', student: true } },
  { path: '/learning-report/:id', name: 'LearningReportView', component: LearningReportView, meta: { title: '学习报告', student: true } },
  { path: '/report-list', name: 'ReportList', component: ReportList, meta: { title: '错因报告', student: true } },
  { path: '/mistake-report/:id', name: 'MistakeReport', component: MistakeReport, meta: { title: '错因分析', student: true } },
  { path: '/variants', name: 'Variants', component: Variants, meta: { title: '变式题', student: true } },
  { path: '/variant-list', name: 'VariantList', component: VariantList, meta: { title: '已保存变式题', student: true } },
  { path: '/practice', name: 'Practice', component: Practice, meta: { title: '开始练习', student: true } },
  { path: '/explain/:id', name: 'QuestionExplain', component: QuestionExplain, meta: { title: '错题讲解', student: true } },
  { path: '/classroom', name: 'Classroom', component: Classroom, meta: { title: '我的老师', student: true } },
  { path: '/class-notebooks', name: 'ClassNotebooks', component: ClassNotebooks, meta: { title: '班级错题本', student: true } },
  { path: '/class-notebooks/:id', name: 'ClassNotebookPractice', component: ClassNotebookPractice, meta: { title: '班级错题本', student: true } },
  { path: '/homework', name: 'StudentHomework', component: StudentHomework, meta: { title: '我的作业', student: true } },
  { path: '/homework/:id', name: 'StudentHomeworkDetail', component: StudentHomeworkDetail, meta: { title: '作业', student: true } },
  { path: '/parent-reports', name: 'ParentReports', component: ParentReports, meta: { title: '家长端报告', student: true } },
  { path: '/parent-reports/:id', name: 'ParentReportView', component: ParentReports, meta: { title: '家长端报告', student: true } },
  { path: '/plaza', name: 'CheckinPlaza', component: CheckinPlaza, meta: { title: '打卡广场' } },
  { path: '/community', name: 'Community', component: Community, meta: { title: '学习社区' } },
  { path: '/community/help', name: 'HelpBoard', component: HelpBoard, meta: { title: '互助答疑' } },
  { path: '/community/help/:id', name: 'HelpDetail', component: HelpDetail, meta: { title: '互助详情' } },
  { path: '/community/pk', name: 'FriendsPk', component: FriendsPk, meta: { title: '好友 PK' } },
  { path: '/community/pk/:id', name: 'PkPlay', component: PkPlay, meta: { title: '答题 PK' } },
  { path: '/orgs', name: 'OrgCases', component: OrgCases, meta: { title: '机构版', public: true } },
  { path: '/orgs/:slug/bank', name: 'OrgMemberBank', component: OrgMemberBank, meta: { title: '机构题库', student: true } },
  { path: '/orgs/:slug/practice', name: 'OrgBankPractice', component: OrgBankPractice, meta: { title: '机构练习', student: true } },
  { path: '/orgs/:slug', name: 'OrgCaseDetail', component: OrgCaseDetail, meta: { title: '机构主页', public: true } },

  { path: '/teacher', name: 'TeacherHome', component: TeacherHome, meta: { title: '班级工作台', teacher: true } },
  { path: '/teacher/questions', name: 'TeacherQuestions', component: TeacherQuestions, meta: { title: '全班题目', teacher: true } },
  { path: '/teacher/capture', name: 'TeacherCapture', component: TeacherCapture, meta: { title: '拍照识别', teacher: true } },
  { path: '/teacher/bank-picker', name: 'TeacherBankPicker', component: TeacherBankPicker, meta: { title: '勾选题库', teacher: true } },
  { path: '/teacher/sets/:type/:id', name: 'TeacherSetDetail', component: TeacherSetDetail, meta: { title: '试卷详情', teacher: true } },
  { path: '/teacher/assistant', name: 'TeacherAssistant', component: TeacherAssistant, meta: { title: '班级助手', teacher: true } },
  { path: '/teacher/paper', name: 'TeacherPaperHub', component: TeacherPaperHub, meta: { title: '班级组卷', teacher: true } },
  { path: '/teacher/send', name: 'TeacherSend', component: TeacherSend, meta: { title: '发给班级', teacher: true } },
  { path: '/teacher/mine', name: 'TeacherMine', component: TeacherMine, meta: { title: '我的', teacher: true } },
      { path: '/teacher/org', name: 'TeacherOrg', component: TeacherOrg, meta: { title: '机构工作台', teacher: true } },
  { path: '/teacher/report', name: 'TeacherClassReport', component: TeacherClassReport, meta: { title: '家长报告', teacher: true } },
  { path: '/teacher/students', name: 'TeacherStudents', component: TeacherStudents, meta: { title: '班级学生', teacher: true } },
  { path: '/teacher/students/:id', name: 'TeacherStudentDetail', component: TeacherStudentDetail, meta: { title: '学生详情', teacher: true } },
  { path: '/teacher/class-notebooks', name: 'TeacherClassNotebooks', component: TeacherClassNotebooks, meta: { title: '班级错题本', teacher: true } },
  { path: '/teacher/class-notebooks/:id', name: 'TeacherNotebookDetail', component: TeacherNotebookDetail, meta: { title: '班级错题本', teacher: true } },
  { path: '/teacher/homework', name: 'TeacherHomework', component: TeacherHomework, meta: { title: '作业批改', teacher: true } },
  { path: '/teacher/homework/:id', name: 'TeacherHomeworkDetail', component: TeacherHomeworkDetail, meta: { title: '作业详情', teacher: true } },
  { path: '/teacher/analytics', name: 'TeacherAnalytics', component: TeacherAnalytics, meta: { title: '教学效果分析', teacher: true } },
  { path: '/teacher/parent-reports/:id', name: 'TeacherParentReport', component: TeacherParentReport, meta: { title: '家长端报告', teacher: true } }
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
  const teacher = isLoggedIn() && isTeacher()
  if (to.path === '/login' && isLoggedIn()) {
    const redirect = to.query.redirect
    if (!teacher && typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
      next(redirect)
      return
    }
    next(teacher ? '/teacher' : '/homepage')
    return
  }
  // 教师账号没有学生端的错题本流程，学生也进不了教师后台
  if (teacher && to.meta.student) {
    next('/teacher')
    return
  }
  if (!teacher && to.meta.teacher) {
    next('/homepage')
    return
  }
  next()
})

export default router
