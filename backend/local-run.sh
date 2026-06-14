#!/bin/bash
# 本地开发启动脚本（macOS / Linux）

set -e
cd "$(dirname "$0")"

echo "==> 错题本后端 - 本地启动"
echo ""

# Java 17
if [ -d "/opt/homebrew/opt/openjdk@17" ]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

if ! command -v java >/dev/null 2>&1; then
  echo "❌ 未找到 Java，请先安装：brew install openjdk@17"
  exit 1
fi

if ! command -v mvn >/dev/null 2>&1; then
  echo "❌ 未找到 Maven，请先安装：brew install maven"
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "⚠️  未找到 .env，从 .env.example 复制..."
  cp .env.example .env
  echo "请编辑 backend/.env 填入数据库密码和 API Key 后重新运行"
  exit 1
fi

# 检查 MySQL
if ! command -v mysql >/dev/null 2>&1; then
  echo "⚠️  未找到 mysql 客户端，请安装：brew install mysql && brew services start mysql"
else
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  if ! mysql -h "${DB_HOST:-localhost}" -P "${DB_PORT:-3306}" -u "${DB_USERNAME:-root}" -p"${DB_PASSWORD}" -e "SELECT 1" >/dev/null 2>&1; then
    echo "⚠️  MySQL 连接失败，请确认："
    echo "   1. MySQL 已启动：brew services start mysql"
    echo "   2. backend/.env 中 DB_USERNAME / DB_PASSWORD 正确"
    echo ""
    read -r -p "仍要继续启动后端吗？[y/N] " ans
    [[ "$ans" =~ ^[Yy]$ ]] || exit 1
  else
    echo "✅ MySQL 连接正常"
  fi
fi

mkdir -p uploads logs

echo ""
echo "🚀 启动 Spring Boot（profile=dev）..."
echo "   API: http://localhost:8080/api"
echo ""

mvn spring-boot:run -Dspring-boot.run.profiles=dev
