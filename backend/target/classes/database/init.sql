-- 创建数据库
CREATE DATABASE IF NOT EXISTS mistake_notebook 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE mistake_notebook;

-- 由于使用了 Spring Data JPA，表结构会自动创建
-- 这里只需要确保数据库存在即可 