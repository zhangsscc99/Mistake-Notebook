/**
 * 微信小程序 CI 编译脚本
 * 无需打开开发者工具 GUI，纯命令行完成预览和上传
 *
 * 使用方法：
 *   node build.cjs preview   # 生成预览二维码
 *   node build.cjs upload    # 上传为体验版
 *
 * 前置条件：
 *   1. 到微信公众平台 mp.weixin.qq.com → 开发 → 开发设置 → 下载代码上传密钥
 *   2. 将密钥文件放到项目根目录，命名为 private.key
 *   3. 在开发设置中配置 IP 白名单（或关闭 IP 限制）
 */

const ci = require('miniprogram-ci');
const fs = require('fs');
const path = require('path');

const PROJECT_PATH = path.resolve(__dirname, '.');
const APPID = 'wxc11e37ee3cdda2ad';
const PRIVATE_KEY_PATH = path.resolve(__dirname, 'private.key');

// 检查密钥是否存在
if (!fs.existsSync(PRIVATE_KEY_PATH)) {
  console.log('⚠️  未找到 private.key，请先到微信公众平台下载代码上传密钥');
  console.log('   路径: 微信公众平台 → 开发 → 开发设置 → 下载代码上传密钥');
  console.log('');
  console.log('💡 没有密钥也可以先用开发者工具 CLI 预览：');
  console.log('   cli.bat auto-preview --project .');
  process.exit(0);
}

const project = new ci.Project({
  appid: APPID,
  type: 'miniProgram',
  projectPath: PROJECT_PATH,
  privateKeyPath: PRIVATE_KEY_PATH,
  ignores: ['node_modules/**/*', '.git/**/*', 'frontend/**/*', 'backend/**/*'],
});

const action = process.argv[2] || 'preview';

(async () => {
  if (action === 'upload') {
    console.log('📤 正在上传代码...');
    const result = await ci.upload({
      project,
      version: '1.0.0',
      desc: '自动化构建上传',
      setting: {
        es6: true,
        es7: true,
        minifyJS: true,
        minifyWXML: true,
        minifyWXSS: true,
        autoPrefixWXSS: true,
      },
      onProgressUpdate: console.log,
    });
    console.log('✅ 上传成功！', result);
  } else {
    console.log('🔍 正在生成预览二维码...');
    const result = await ci.preview({
      project,
      desc: '本地开发预览',
      setting: {
        es6: true,
        es7: true,
        autoPrefixWXSS: true,
      },
      qrcodeFormat: 'image',
      qrcodeOutputDest: path.resolve(__dirname, 'preview-qrcode.jpg'),
      onProgressUpdate: console.log,
    });
    console.log('✅ 预览二维码已生成：preview-qrcode.jpg');
    console.log('   用微信扫码即可在手机上预览');
  }
})().catch((err) => {
  console.error('❌ 构建失败:', err.message);
  console.log('');
  console.log('💡 替代方案 - 用开发者工具 CLI 预览（需要工具已在后台运行）：');
  console.log('   cli.bat auto-preview --project .');
});
