#!/bin/bash

# 阿里云百炼平台环境变量配置脚本
# 使用方法：source set-env.sh

echo "正在设置环境变量..."

# 阿里云百炼平台API密钥
export DASHSCOPE_API_KEY="sk-b2ccb84e15b544bc84e9a8a02cb4e168"

# 视觉推理模型配置
export DASHSCOPE_VISION_MODEL="qwen3-vl-plus"
export DASHSCOPE_ENABLE_THINKING="true"
export DASHSCOPE_THINKING_BUDGET="81920"
export DASHSCOPE_MAX_TOKENS="4000"
export DASHSCOPE_TEMPERATURE="0.1"

# OCR服务配置
export ALIYUN_OCR_USE_VISION_REASONING="true"

# 数据库配置
export DB_USERNAME="root"
export DB_PASSWORD="wyt!!010611ABC"

echo "环境变量设置完成！"
echo "当前配置："
echo "- DASHSCOPE_API_KEY: ${DASHSCOPE_API_KEY:0:20}..."
echo "- DASHSCOPE_VISION_MODEL: $DASHSCOPE_VISION_MODEL"
echo "- ALIYUN_OCR_USE_VISION_REASONING: $ALIYUN_OCR_USE_VISION_REASONING"
