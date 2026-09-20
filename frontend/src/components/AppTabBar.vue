<template>
  <van-tabbar route class="app-tabbar" safe-area-inset-bottom>
    <van-tabbar-item icon="home-o" to="/homepage">首页</van-tabbar-item>
    <van-tabbar-item icon="apps-o" to="/categories">分类</van-tabbar-item>
    <van-tabbar-item icon="chat-o" to="/ai-chat">对话</van-tabbar-item>
    <van-tabbar-item icon="edit" to="/paper-builder">组卷</van-tabbar-item>
    <van-tabbar-item icon="friends-o" to="/community">社区</van-tabbar-item>
    <van-tabbar-item icon="user-o" to="/profile">我的</van-tabbar-item>
  </van-tabbar>
</template>

<script>
export default { name: 'AppTabBar' }
</script>

<style scoped>
.app-tabbar {
  background: rgba(255, 255, 255, 0.92) !important;
  border-top: 1px solid rgba(11, 22, 51, 0.06) !important;
  z-index: 3000 !important;
}
.app-tabbar :deep(.van-tabbar-item) {
  padding: 6px 0 !important;
  margin: 0 !important;
  cursor: pointer;
  border-radius: 12px;
  transition: background-color 0.18s ease, color 0.18s ease;
}
.app-tabbar :deep(.van-tabbar-item:hover) {
  background: rgba(36, 89, 255, 0.08);
}
.app-tabbar :deep(.van-tabbar-item__text) {
  font-size: 11px;
}
</style>
