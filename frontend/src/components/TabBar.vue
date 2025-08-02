<template>
  <van-tabbar v-model="activeTab" class="custom-tabbar">
    <van-tabbar-item icon="camera-o" to="/camera">拍照</van-tabbar-item>
    <van-tabbar-item icon="apps-o" to="/categories">分类</van-tabbar-item>
    <van-tabbar-item icon="edit" to="/paper-builder">组卷</van-tabbar-item>
  </van-tabbar>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'TabBar',
  setup() {
    const activeTab = ref(0)
    
    return {
      activeTab
    }
  }
}
</script>

<style scoped>
.custom-tabbar {
  background: var(--bg-glass) !important;
  backdrop-filter: blur(12px) !important;
  border-top: 1px solid var(--border-color) !important;
  box-shadow: 0 -2px 16px rgba(0, 0, 0, 0.3) !important;
}
</style>