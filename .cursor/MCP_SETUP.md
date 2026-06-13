# MCP 配置说明

## cloudbase（无需修改，自动生效）

使用 `npx` 运行，任何装了 Node.js 的机器 git pull 后直接可用。

## wechat-devtools（需要手动调整路径）

在 `mcp.json` 里找到 `wechat-devtools` 条目，修改以下三处：

| 字段 | 说明 | 示例值 |
|---|---|---|
| `command` | wechat-devtools-mcp.exe 的完整路径 | `C:\Users\<你的用户名>\.local\bin\wechat-devtools-mcp.exe` |
| `WECHAT_DEVTOOLS_CLI` | 微信开发者工具 cli.bat 路径（默认安装路径通常一样） | `C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat` |
| `WECHAT_PROJECT_PATH` | 本项目在这台电脑上的绝对路径 | `C:\Users\<你的用户名>\Desktop\Mistake-Notebook` |

### 安装 wechat-devtools-mcp
如果另一台电脑还没装，运行：
```
pip install wechat-devtools-mcp
```
或参考：https://github.com/cso1z/Weixin-MCP-Server
