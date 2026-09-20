<template>
  <van-tabbar route class="app-tabbar" safe-area-inset-bottom>
    <van-tabbar-item icon="wap-home-o" to="/teacher">班级</van-tabbar-item>
    <van-tabbar-item icon="camera-o" to="/teacher/capture">拍照</van-tabbar-item>
    <van-tabbar-item icon="apps-o" to="/teacher/questions">题目</van-tabbar-item>
    <van-tabbar-item icon="chat-o" to="/teacher/assistant">助手</van-tabbar-item>
    <van-tabbar-item icon="edit" to="/teacher/paper">组卷</van-tabbar-item>
    <van-tabbar-item icon="user-o" to="/teacher/mine">我的</van-tabbar-item>
  </van-tabbar>
</template>

<script>
export default { name: 'TeacherTabBar' }
</script>

<style scoped>
.app-tabbar {
  background: rgba(255, 255, 255, 0.92) !important;
  border-top: 1px solid rgba(11, 22, 51, 0.06) !important;
  z-index: 3000 !important;
}
.app-tabbar :deep(.van-tabbar-item) {
  cursor: pointer;
  border-radius: 12px;
  transition: background-color 0.18s ease, color 0.18s ease;
}
.app-tabbar :deep(.van-tabbar-item:hover) {
  background: rgba(36, 89, 255, 0.08);
}
</style>
