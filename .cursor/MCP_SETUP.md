# MCP 配置说明

## cloudbase（无需修改，自动生效）

使用 `npx` 运行，任何装了 Node.js 的机器 git pull 后直接可用。

---

## wechat-devtools（需要调整路径）

| 字段 | 说明 |
|---|---|
| `command` | wechat-devtools-mcp.exe 的完整路径，把 `宇庭` 改成这台电脑的用户名 |
| `WECHAT_DEVTOOLS_CLI` | 微信开发者工具 cli.bat，默认安装路径通常不变 |
| `WECHAT_PROJECT_PATH` | 本项目在这台电脑上的绝对路径 |

安装：`pip install wechat-devtools-mcp`

---

## weixin-devtools-mcp（需要调整路径）

| 字段 | 说明 |
|---|---|
| `command` | Node.js 可执行文件路径，通常为 `C:\Program Files\nodejs\node.exe` |
| `args[0]` | server.js 路径，把 `宇庭` 改成这台电脑的用户名 |

安装：在 Cursor 设置里搜索并安装 `weixin-devtools-mcp`，或：
```
cd C:\Users\<用户名>\.cursor\mcp-servers\weixin-devtools-mcp
npm install weixin-devtools-mcp
```

---

## ue-mcp（需要调整路径）

| 字段 | 说明 |
|---|---|
| `args[1]` | Unreal 项目的 .uproject 文件路径，改成这台电脑上对应项目的路径 |

安装：`npx ue-mcp` 会自动下载，无需额外安装。
