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
