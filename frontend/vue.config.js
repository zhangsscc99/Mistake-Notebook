const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    port: 3060,
    host: '0.0.0.0',
    open: true,
    // 禁用 overlay 错误提示，避免阻塞页面
    client: {
      overlay: {
        errors: false,
        warnings: false,
      },
    },
  },
  // 生产环境构建配置
  productionSourceMap: false,
  // 关闭 ESLint
  lintOnSave: false,
  // PWA配置（可选）
  pwa: {
    name: '错题本整理',
    themeColor: '#E8A855',
    msTileColor: '#E8A855',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'default'
  }
})