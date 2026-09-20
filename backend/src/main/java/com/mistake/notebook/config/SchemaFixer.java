package com.mistake.notebook.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * 分类从「全站一份」改成「每人十科」后，必须去掉 categories.name 的全局唯一索引，
 * 否则第二个用户无法再插入「数学」。
 */
@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class SchemaFixer implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        try {
            List<Map<String, Object>> indexes = jdbcTemplate.queryForList(
                    "SHOW INDEX FROM categories WHERE Column_name = 'name' AND Non_unique = 0");
            for (Map<String, Object> idx : indexes) {
                String key = String.valueOf(idx.get("Key_name"));
                if ("PRIMARY".equalsIgnoreCase(key)) continue;
                try {
                    jdbcTemplate.execute("ALTER TABLE categories DROP INDEX `" + key + "`");
                    log.info("已去掉 categories 上的全局唯一索引 {}", key);
                } catch (Exception e) {
                    log.warn("去掉索引 {} 失败：{}", key, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("检查 categories 索引失败（库未就绪时可忽略）：{}", e.getMessage());
        }
        ensureColumn("users", "chat_day_key", "`chat_day_key` VARCHAR(16) DEFAULT ''");
        ensureColumn("users", "chat_used_count", "`chat_used_count` INT NOT NULL DEFAULT 0");
        ensureColumn("users", "role", "`role` VARCHAR(16) DEFAULT 'STUDENT'");
        ensureColumn("users", "invite_code", "`invite_code` VARCHAR(16) DEFAULT ''");
        ensureColumn("users", "school", "`school` VARCHAR(60) DEFAULT ''");
        ensureColumn("users", "class_name", "`class_name` VARCHAR(60) DEFAULT ''");
        ensureColumn("mistake_reports", "question_ids", "`question_ids` TEXT");
        ensureColumn("mistake_reports", "question_count", "`question_count` INT DEFAULT 1");
        ensureColumn("questions", "source", "`source` VARCHAR(32) DEFAULT ''");
        ensureColumn("questions", "class_id", "`class_id` BIGINT NULL");
        ensureColumn("homeworks", "class_id", "`class_id` BIGINT NULL");
        ensureColumn("homework_submissions", "marks_json", "`marks_json` TEXT");
        ensureColumn("class_notebooks", "class_id", "`class_id` BIGINT NULL");
        ensureColumn("class_notebooks", "question_ids", "`question_ids` TEXT");
        ensureColumn("parent_reports", "class_id", "`class_id` BIGINT NULL");
        ensureColumn("parent_reports", "snapshot_json", "`snapshot_json` LONGTEXT");
        ensureTable("teacher_classes", """
                CREATE TABLE IF NOT EXISTS `teacher_classes` (
                  `id` BIGINT NOT NULL AUTO_INCREMENT,
                  `teacher_id` BIGINT NOT NULL,
                  `name` VARCHAR(80) NOT NULL,
                  `grade` VARCHAR(40) DEFAULT '',
                  `join_code` VARCHAR(16) NOT NULL,
                  `is_deleted` TINYINT(1) DEFAULT 0,
                  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `uk_teacher_classes_join` (`join_code`),
                  KEY `idx_teacher_classes_teacher` (`teacher_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        ensureTable("class_members", """
                CREATE TABLE IF NOT EXISTS `class_members` (
                  `id` BIGINT NOT NULL AUTO_INCREMENT,
                  `class_id` BIGINT NOT NULL,
                  `student_id` BIGINT NOT NULL,
                  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
                  `requested_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                  `approved_at` DATETIME NULL,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `uk_class_member` (`class_id`, `student_id`),
                  KEY `idx_class_members_student` (`student_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        ensureTable("teacher_papers", """
                CREATE TABLE IF NOT EXISTS `teacher_papers` (
                  `id` BIGINT NOT NULL AUTO_INCREMENT,
                  `teacher_id` BIGINT NOT NULL,
                  `class_id` BIGINT NULL,
                  `title` VARCHAR(120) NOT NULL,
                  `question_ids` TEXT,
                  `question_count` INT DEFAULT 0,
                  `duration` INT DEFAULT 90,
                  `is_deleted` TINYINT(1) DEFAULT 0,
                  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (`id`),
                  KEY `idx_teacher_papers_teacher` (`teacher_id`),
                  KEY `idx_teacher_papers_class` (`class_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        try {
            jdbcTemplate.execute("ALTER TABLE `teacher_papers` MODIFY COLUMN `class_id` BIGINT NULL");
        } catch (Exception e) {
            log.warn("teacher_papers.class_id 改为可空失败（可忽略）：{}", e.getMessage());
        }
        ensureTable("checkin_posts", """
                CREATE TABLE IF NOT EXISTS `checkin_posts` (
                  `id` BIGINT NOT NULL AUTO_INCREMENT,
                  `user_id` BIGINT NOT NULL,
                  `day_key` VARCHAR(16) NOT NULL,
                  `content` VARCHAR(160) DEFAULT '',
                  `streak` INT NOT NULL DEFAULT 0,
                  `total_days` INT NOT NULL DEFAULT 0,
                  `question_count` INT NOT NULL DEFAULT 0,
                  `like_count` INT NOT NULL DEFAULT 0,
                  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (`id`),
                  KEY `idx_checkin_posts_created` (`created_at`),
                  UNIQUE KEY `uk_checkin_posts_user_day` (`user_id`, `day_key`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        ensureTable("checkin_post_likes", """
                CREATE TABLE IF NOT EXISTS `checkin_post_likes` (
                  `id` BIGINT NOT NULL AUTO_INCREMENT,
                  `post_id` BIGINT NOT NULL,
                  `user_id` BIGINT NOT NULL,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `uk_checkin_like_post_user` (`post_id`, `user_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        ensureTable("help_posts", """
                CREATE TABLE IF NOT EXISTS `help_posts` (
                  `id` BIGINT NOT NULL AUTO_INCREMENT,
                  `user_id` BIGINT NOT NULL,
                  `nick_name` VARCHAR(40) DEFAULT '',
                  `subject` VARCHAR(20) DEFAULT '',
                  `title` VARCHAR(80) NOT NULL,
                  `content` VARCHAR(800) NOT NULL,
                  `snippet` VARCHAR(200) DEFAULT '',
                  `reply_count` INT NOT NULL DEFAULT 0,
                  `seeded` TINYINT(1) NOT NULL DEFAULT 0,
                  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (`id`),
                  KEY `idx_help_posts_created` (`created_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        ensureTable("help_replies", """
                CREATE TABLE IF NOT EXISTS `help_replies` (
                  `id` BIGINT NOT NULL AUTO_INCREMENT,
                  `post_id` BIGINT NOT NULL,
                  `user_id` BIGINT NOT NULL,
                  `nick_name` VARCHAR(40) DEFAULT '',
                  `content` VARCHAR(500) NOT NULL,
                  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (`id`),
                  KEY `idx_help_replies_post` (`post_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        ensureTable("friendships", """
                CREATE TABLE IF NOT EXISTS `friendships` (
                  `id` BIGINT NOT NULL AUTO_INCREMENT,
                  `user_id` BIGINT NOT NULL,
                  `friend_id` BIGINT NOT NULL,
                  `status` VARCHAR(16) NOT NULL,
                  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `uk_friendship_pair` (`user_id`, `friend_id`),
                  KEY `idx_friendship_friend` (`friend_id`, `status`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        ensureTable("pk_matches", """
                CREATE TABLE IF NOT EXISTS `pk_matches` (
                  `id` BIGINT NOT NULL AUTO_INCREMENT,
                  `challenger_id` BIGINT NOT NULL,
                  `opponent_id` BIGINT NOT NULL,
                  `challenger_score` INT NOT NULL DEFAULT 0,
                  `opponent_score` INT NOT NULL DEFAULT 0,
                  `winner_id` BIGINT DEFAULT NULL,
                  `status` VARCHAR(16) NOT NULL,
                  `snapshot_json` TEXT,
                  `mode` VARCHAR(16) DEFAULT 'POWER',
                  `questions_json` TEXT,
                  `challenger_answers` TEXT,
                  `opponent_answers` TEXT,
                  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (`id`),
                  KEY `idx_pk_challenger` (`challenger_id`),
                  KEY `idx_pk_opponent` (`opponent_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        ensureColumn("help_posts", "question_id", "`question_id` BIGINT NULL");
        ensureColumn("help_posts", "like_count", "`like_count` INT NOT NULL DEFAULT 0");
        ensureColumn("pk_matches", "mode", "`mode` VARCHAR(16) DEFAULT 'POWER'");
        ensureColumn("pk_matches", "questions_json", "`questions_json` TEXT");
        ensureColumn("pk_matches", "challenger_answers", "`challenger_answers` TEXT");
        ensureColumn("pk_matches", "opponent_answers", "`opponent_answers` TEXT");
        ensureTable("help_post_likes", """
                CREATE TABLE IF NOT EXISTS `help_post_likes` (
                  `id` BIGINT NOT NULL AUTO_INCREMENT,
                  `post_id` BIGINT NOT NULL,
                  `user_id` BIGINT NOT NULL,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `uk_help_like_post_user` (`post_id`, `user_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        ensureTable("organizations", """
                CREATE TABLE IF NOT EXISTS `organizations` (
                  `id` BIGINT NOT NULL AUTO_INCREMENT,
                  `slug` VARCHAR(40) NOT NULL,
                  `name` VARCHAR(80) NOT NULL,
                  `short_name` VARCHAR(20) DEFAULT '',
                  `city` VARCHAR(40) DEFAULT '',
                  `mark` VARCHAR(8) DEFAULT '',
                  `tagline` VARCHAR(200) DEFAULT '',
                  `headline` VARCHAR(200) DEFAULT '',
                  `pitch` TEXT,
                  `logo_url` TEXT,
                  `primary_color` VARCHAR(16) DEFAULT '#2459ff',
                  `accent_color` VARCHAR(16) DEFAULT '#52b7ff',
                  `owner_id` BIGINT NULL,
                  `demo` TINYINT(1) NOT NULL DEFAULT 0,
                  `quote` VARCHAR(400) DEFAULT '',
                  `quote_by` VARCHAR(80) DEFAULT '',
                  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `uk_org_slug` (`slug`),
                  UNIQUE KEY `uk_org_owner` (`owner_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        ensureColumn("organizations", "published", "`published` TINYINT(1) NOT NULL DEFAULT 0");
        ensureColumn("organizations", "join_code", "`join_code` VARCHAR(16) DEFAULT ''");
        ensureTable("org_members", """
                CREATE TABLE IF NOT EXISTS `org_members` (
                  `id` BIGINT NOT NULL AUTO_INCREMENT,
                  `org_id` BIGINT NOT NULL,
                  `student_id` BIGINT NOT NULL,
                  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
                  `requested_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                  `approved_at` DATETIME NULL,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `uk_org_member` (`org_id`, `student_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
    }

    private void ensureTable(String table, String ddl) {
        try {
            Integer n = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
                    Integer.class, table);
            if (n != null && n == 0) {
                jdbcTemplate.execute(ddl);
                log.info("已补齐表 {}", table);
            }
        } catch (Exception e) {
            log.warn("检查表 {} 失败（库未就绪时可忽略）：{}", table, e.getMessage());
        }
    }

    private void ensureColumn(String table, String column, String definition) {
        try {
            Integer n = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                    Integer.class, table, column);
            if (n != null && n == 0) {
                jdbcTemplate.execute("ALTER TABLE `" + table + "` ADD COLUMN " + definition);
                log.info("已补齐 {}.{}", table, column);
            }
        } catch (Exception e) {
            log.warn("检查 {}.{} 失败（库未就绪时可忽略）：{}", table, column, e.getMessage());
        }
    }
}
