# 微信小程序：智能错题本 (WeChat Mini Program)

本项目是“智能错题本”的微信小程序原生版本，与后端 Spring Boot 接口直接对接，支持一键拍照、AI 自动去手写、多学科智能分类、拼装试卷并极速导出 A4 打印版 PDF。

## 目录结构

```text
Mistake-Notebook/
├── backend/               # Spring Boot 独立后端
├── frontend/              # 网页版 (Vue3 / Vant)
├── cloudfunctions/        # 微信小程序云函数根目录 (如需微信云开发)
├── miniprogram/           # 微信小程序源码根目录
│   ├── app.js             # 小程序入口
│   ├── app.json           # 小程序全局配置 (页面、TabBar、窗口样式)
│   ├── app.wxss           # 全局样式文件
│   ├── pages/             # 页面文件
│   │   ├── index/         # 首页 (拍照录入、AI 识别分析)
│   │   ├── categories/    # 分类页 (错题本学科概览)
│   │   ├── categoryDetail/ # 分类详情页 (查看与管理各科错题、查看 AI 解析)
│   │   ├── paperBuilder/  # 试卷页 (设置试卷信息、拼装错题)
│   │   ├── questionSelector/# 选择题目 (跨学科挑选错题加入试卷)
│   │   └── settings/      # 设置页 (配置后端 API 地址、清空缓存)
│   └── images/            # 小程序所需的图标与插图
└── project.config.json    # 微信开发者工具项目配置文件
```

## 快速使用说明

### 步骤一：导入微信开发者工具
1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 打开微信开发者工具，点击 **【导入项目】** (或【+】新建项目 -> 导入)。
3. 选择您本地的 **整个项目根目录 (`C:\Users\宇庭\Desktop\Mistake-Notebook`)**。
4. 开发者工具会自动识别到根目录下的 `project.config.json`，并把开发目录自动聚焦在 `miniprogram` 和 `cloudfunctions` 文件夹。

### 步骤二：开启域名不校验 (本地开发必须)
因为本地开发的后端 API 地址通常为 `http://localhost:8080/api` 或者是您的局域网 IP，在微信开发者工具中：
1. 点击右上角的 **【详情】** 按钮。
2. 切换到 **【本地设置】** 面板。
3. 勾选 **【不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书】**。

### 步骤三：连接您的 Spring Boot 后端 (二选一)
* **模式 A（离线演示模式 - 默认）：**
  即便本地没有启动 Spring Boot 后端，小程序内置了全套的模拟流和精美 Mock 数据。您可以直接拍照上传，程序将自动演示 AI 智能识别、去手写笔迹分类、以及 A4 纸试卷 PDF 生成的完整流程。
* **模式 B（直连真机/本地服务）：**
  1. 运行并启动您的 `backend` Spring Boot 服务。
  2. 确保您的电脑与调试用的手机连接在 **同一个 Wi-Fi (局域网)** 下。
  3. 在小程序内，点击底部的【设置】标签页，在“后端服务地址”中填入您电脑的局域网 IP (例如 `http://192.168.1.100:8080/api`)。
  4. 随后所有的拍照、错题分类、生成试卷 PDF 均会直接存入并调用您本地的 Spring Boot 服务与数据库。
