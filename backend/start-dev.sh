#!/bin/bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export PATH="$JAVA_HOME/bin:$PATH"
cd "$(dirname "$0")"
exec $JAVA_HOME/bin/java -jar target/notebook-backend-1.0.0.jar \
  --spring.profiles.active=dev \
  --spring.datasource.password=notebook123 \
  --spring.datasource.username=root
