#!/bin/bash

# 阿里云百炼平台环境变量配置脚本
# 使用方法：source set-env.sh
#
# 密钥不再硬编码在本文件里 —— 仓库是公开的，之前写死的那把 key
# 就是因为躺在公开仓库中被扫描到，触发了自动撤销，AI 功能整个挂掉。
# 真实值放在 backend/.env，它已被 .gitignore 忽略，不会进仓库。
# 另外注意：pom 里没有 dotenv 依赖，Spring 只认进程环境变量，
# 所以 backend/.env 必须由本脚本 export 出去才会生效。

ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 找不到 $ENV_FILE"
  echo "   请先执行：cp backend/.env.example backend/.env，再填入你自己的密钥"
  return 1 2>/dev/null || exit 1
fi

echo "正在从 backend/.env 加载环境变量..."

# set -a 让 source 进来的赋值自动带上 export
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# 兜底：.env 里没写视觉相关配置时用默认值
export DASHSCOPE_VISION_MODEL="${DASHSCOPE_VISION_MODEL:-qwen3-vl-plus}"
export DASHSCOPE_ENABLE_THINKING="${DASHSCOPE_ENABLE_THINKING:-true}"
export DASHSCOPE_THINKING_BUDGET="${DASHSCOPE_THINKING_BUDGET:-81920}"
export DASHSCOPE_MAX_TOKENS="${DASHSCOPE_MAX_TOKENS:-4000}"
export DASHSCOPE_TEMPERATURE="${DASHSCOPE_TEMPERATURE:-0.1}"
export ALIYUN_OCR_USE_VISION_REASONING="${ALIYUN_OCR_USE_VISION_REASONING:-true}"

if [ -z "$DASHSCOPE_API_KEY" ]; then
  echo "⚠️  DASHSCOPE_API_KEY 为空，请检查 $ENV_FILE"
fi

echo "环境变量设置完成！"
echo "当前配置："
echo "- DASHSCOPE_API_KEY: ${DASHSCOPE_API_KEY:0:20}..."
echo "- DASHSCOPE_VISION_MODEL: $DASHSCOPE_VISION_MODEL"
echo "- ALIYUN_OCR_USE_VISION_REASONING: $ALIYUN_OCR_USE_VISION_REASONING"
