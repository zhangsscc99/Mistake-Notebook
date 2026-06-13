# MCP 配置说明

以下 MCP 配置需根据另一台电脑的路径做相应调整。

---

## ✅ 无需修改（直接生效）

### cloudbase
使用 `npx`，任何装了 Node.js 的机器直接可用。

### playwright
使用 `npx`，任何装了 Node.js 的机器直接可用。

---

## ⚠️ 需要调整路径

### browser-use

| 字段 | 说明 |
|---|---|
| `command` | `uv.exe` 的路径，把 `宇庭` 改成当前机器用户名 |

安装（若未安装）：
```
pip install uv
uv tool install browser-use[cli]
```

---

### wechat-devtools

| 字段 | 说明 |
|---|---|
| `command` | wechat-devtools-mcp.exe 路径，把 `宇庭` 改成当前用户名 |
| `WECHAT_DEVTOOLS_CLI` | 微信开发者工具 cli.bat，默认安装路径通常不变 |
| `WECHAT_PROJECT_PATH` | 本项目在当前电脑上的绝对路径 |

安装（若未安装）：`pip install wechat-devtools-mcp`

---

### weixin-devtools-mcp

| 字段 | 说明 |
|---|---|
| `command` | Node.js 路径，通常为 `C:\Program Files\nodejs\node.exe` |
| `args[0]` | server.js 路径，把 `宇庭` 改成当前用户名 |

安装（若未安装）：在 `.cursor\mcp-servers\weixin-devtools-mcp` 目录下执行 `npm install weixin-devtools-mcp`

---

### ue-mcp

| 字段 | 说明 |
|---|---|
| `args[1]` | Unreal 项目的 .uproject 文件路径，改成当前机器上该项目的实际路径 |

`npx ue-mcp` 会自动下载，无需安装。
