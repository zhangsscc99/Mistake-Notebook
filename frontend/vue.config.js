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
  configureWebpack: {
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vant: {
            test: /[\\/]node_modules[\\/]vant[\\/]/,
            name: 'vendor-vant',
            priority: 30,
            enforce: true
          },
          vue: {
            test: /[\\/]node_modules[\\/](@vue|vue|vue-router)[\\/]/,
            name: 'vendor-vue',
            priority: 25,
            enforce: true
          },
          common: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor-common',
            priority: 10,
            reuseExistingChunk: true
          }
        }
      }
    }
  },
  // PWA配置（可选）
  pwa: {
    name: '错题本整理',
    themeColor: '#E8A855',
    msTileColor: '#E8A855',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'default'
  }
})
