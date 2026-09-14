#!/bin/bash

# 启动错题本应用（支持视觉推理）

echo "🚀 启动错题本应用（视觉推理模式）"
echo "=================================="

# 密钥从 backend/.env 读取，不硬编码（仓库是公开的，见 set-env.sh 顶部说明）。
# Spring 只认进程环境变量，所以这里必须 export 出去。
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ENV_FILE="$ROOT_DIR/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 找不到 $ENV_FILE"
  echo "   请先执行：cp backend/.env.example backend/.env，再填入你自己的密钥"
  exit 1
fi

echo "正在从 backend/.env 加载环境变量..."
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

export DASHSCOPE_VISION_MODEL="${DASHSCOPE_VISION_MODEL:-qwen3-vl-plus}"
export DASHSCOPE_ENABLE_THINKING="${DASHSCOPE_ENABLE_THINKING:-true}"
export DASHSCOPE_THINKING_BUDGET="${DASHSCOPE_THINKING_BUDGET:-81920}"
export DASHSCOPE_MAX_TOKENS="${DASHSCOPE_MAX_TOKENS:-4000}"
export DASHSCOPE_TEMPERATURE="${DASHSCOPE_TEMPERATURE:-0.1}"
export ALIYUN_OCR_USE_VISION_REASONING="${ALIYUN_OCR_USE_VISION_REASONING:-true}"

if [ -z "$DASHSCOPE_API_KEY" ]; then
  echo "⚠️  DASHSCOPE_API_KEY 为空，AI 相关功能会不可用，请检查 $ENV_FILE"
fi

echo "✅ 环境变量已设置"
echo "- API Key: ${DASHSCOPE_API_KEY:0:20}..."
echo "- 视觉模型: $DASHSCOPE_VISION_MODEL"
echo "- 启用思考: $DASHSCOPE_ENABLE_THINKING"

# 进入后端目录
cd "$ROOT_DIR/backend" || exit 1

echo ""
echo "📦 编译项目..."
mvn compile -q

if [ $? -eq 0 ]; then
    echo "✅ 编译成功"
else
    echo "❌ 编译失败"
    exit 1
fi

echo ""
echo "🌟 启动应用..."
echo "应用将在 http://localhost:8080 启动"
echo "按 Ctrl+C 停止应用"
echo ""

# 启动应用
mvn spring-boot:run -Dspring-boot.run.arguments="--spring.profiles.active=dev" -q
