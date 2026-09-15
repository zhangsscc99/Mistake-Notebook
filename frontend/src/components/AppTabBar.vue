<template>
  <van-tabbar route class="app-tabbar" safe-area-inset-bottom>
    <van-tabbar-item icon="home-o" to="/homepage">首页</van-tabbar-item>
    <van-tabbar-item icon="apps-o" to="/categories">分类</van-tabbar-item>
    <van-tabbar-item icon="chat-o" to="/ai-chat">对话</van-tabbar-item>
    <van-tabbar-item icon="edit" to="/paper-builder">组卷</van-tabbar-item>
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
}
</style>
