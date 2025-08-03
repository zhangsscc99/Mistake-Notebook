-- 创建数据库
CREATE DATABASE IF NOT EXISTS mistake_notebook 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE mistake_notebook;

-- 由于使用了 Spring Data JPA，表结构会自动创建
-- 默认数据初始化已通过 DataInitializer.java 实现，无需SQL脚本 