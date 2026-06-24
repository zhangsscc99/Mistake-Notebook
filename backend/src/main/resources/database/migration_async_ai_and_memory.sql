-- ============================================================
-- 迁移脚本：网页端 AI 异步化 + AI 答疑 SQL 持久化记忆
-- 说明：dev 环境 spring.jpa.hibernate.ddl-auto=update 会自动建列/表，
--       prod 环境为 validate，部署前需先执行本脚本。
-- ============================================================

USE mistake_notebook;

-- 1. 题目表新增 AI 解析状态字段（旧数据默认视为已完成）
ALTER TABLE questions
    ADD COLUMN ai_status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' COMMENT 'AI解析状态: PENDING/PROCESSING/COMPLETED/FAILED',
    ADD COLUMN ai_error TEXT NULL COMMENT 'AI解析失败原因';

-- 将历史题目标记为已完成，便于前端不再显示"解析中"
UPDATE questions SET ai_status = 'COMPLETED' WHERE ai_status IS NULL OR ai_status = '';

-- 2. AI 答疑记忆表（SQL 持久化记忆）
CREATE TABLE IF NOT EXISTS chat_memory (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(64) NOT NULL COMMENT '客户端标识（网页端 localStorage UUID）',
    summary TEXT NULL COMMENT '对话长期摘要',
    topics TEXT NULL COMMENT '知识主题(JSON数组)',
    last_questions TEXT NULL COMMENT '近期提问(JSON数组)',
    last_question_context TEXT NULL COMMENT '最近一次题目上下文',
    session_count INT DEFAULT 0 COMMENT '累计会话数',
    created_at DATETIME NULL,
    updated_at DATETIME NULL,
    UNIQUE KEY idx_chat_memory_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI答疑记忆';
