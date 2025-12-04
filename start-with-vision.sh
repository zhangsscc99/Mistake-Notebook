#!/bin/bash

# 启动错题本应用（支持视觉推理）

echo "🚀 启动错题本应用（视觉推理模式）"
echo "=================================="

# 设置环境变量
export DASHSCOPE_API_KEY="sk-b2ccb84e15b544bc84e9a8a02cb4e168"
export DASHSCOPE_VISION_MODEL="qwen3-vl-plus"
export DASHSCOPE_ENABLE_THINKING="true"
export DASHSCOPE_THINKING_BUDGET="81920"
export DASHSCOPE_MAX_TOKENS="4000"
export DASHSCOPE_TEMPERATURE="0.1"
export ALIYUN_OCR_USE_VISION_REASONING="true"
export DB_USERNAME="root"
export DB_PASSWORD="wyt!!010611ABC"

echo "✅ 环境变量已设置"
echo "- API Key: ${DASHSCOPE_API_KEY:0:20}..."
echo "- 视觉模型: $DASHSCOPE_VISION_MODEL"
echo "- 启用思考: $DASHSCOPE_ENABLE_THINKING"

# 进入后端目录
cd backend

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
