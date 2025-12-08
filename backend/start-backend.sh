#!/bin/bash
# 后端启动脚本（用于 PM2）

cd /root/Mistake-Notebook/backend

# 加载环境变量（和本地启动方式一致）
set -a
source .env
set +a

# 显式导出关键环境变量（处理特殊字符）
export DB_USERNAME
export DB_PASSWORD
export DASHSCOPE_API_KEY
export AI_ALIYUN_API_KEY
export AI_ALIYUN_BASE_URL
export AI_ALIYUN_MODEL
export AI_ALIYUN_APPLICATION_ID
export AI_ALIYUN_SYSTEM_CONTENT
export AI_ALIYUN_PAYMENT_MODEL
export AI_ALIYUN_PAYMENT_SYSTEM_CONTENT
export DASHSCOPE_VISION_MODEL
export DASHSCOPE_ENABLE_THINKING
export DASHSCOPE_THINKING_BUDGET
export DASHSCOPE_MAX_TOKENS
export DASHSCOPE_TEMPERATURE
export ALIYUN_OCR_USE_VISION_REASONING

# 启动后端（默认使用 prod，可通过环境变量 SPRING_PROFILES_ACTIVE 覆盖）
PROFILE=${SPRING_PROFILES_ACTIVE:-prod}
java -jar target/notebook-backend-1.0.0.jar --spring.profiles.active=$PROFILE

