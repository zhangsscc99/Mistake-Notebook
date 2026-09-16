<template>
  <van-tabbar route class="app-tabbar" safe-area-inset-bottom>
    <van-tabbar-item icon="wap-home-o" to="/teacher">工作台</van-tabbar-item>
    <van-tabbar-item icon="friends-o" to="/teacher/students">学员</van-tabbar-item>
    <van-tabbar-item icon="notes-o" to="/teacher/class-notebooks">错题本</van-tabbar-item>
    <van-tabbar-item icon="todo-list-o" to="/teacher/homework">作业</van-tabbar-item>
    <van-tabbar-item icon="chart-trending-o" to="/teacher/analytics">分析</van-tabbar-item>
  </van-tabbar>
</template>

<script>
export default { name: 'TeacherTabBar' }
</script>

<style scoped>
.app-tabbar {
  background: rgba(255, 255, 255, 0.92) !important;
  border-top: 1px solid rgba(11, 22, 51, 0.06) !important;
}
</style>
