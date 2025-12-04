package com.mistake.notebook.config;

import com.mistake.notebook.entity.Category;
import com.mistake.notebook.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

/**
 * 数据初始化器 - 在应用启动时自动初始化默认数据
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final CategoryRepository categoryRepository;

    @Override
    public void run(String... args) throws Exception {
        log.info("开始初始化应用数据...");
        
        initializeCategories();
        
        log.info("数据初始化完成！");
    }

    /**
     * 初始化默认分类数据
     */
    private void initializeCategories() {
        log.info("开始检查并初始化默认分类数据...");

        List<Category> defaultCategories = Arrays.asList(
            createCategory("数学", "数学相关题目", "#E8A855"),
            createCategory("物理", "物理相关题目", "#4A90E2"),
            createCategory("化学", "化学相关题目", "#7ED321"),
            createCategory("英语", "英语相关题目", "#F5A623"),
            createCategory("语文", "语文相关题目", "#BD10E0"),
            createCategory("生物", "生物相关题目", "#50E3C2"),
            createCategory("历史", "历史相关题目", "#D0021B"),
            createCategory("地理", "地理相关题目", "#8B572A"),
            createCategory("计算机/编程", "计算机与编程相关题目", "#2A9D8F"),
            createCategory("政治", "政治相关题目", "#C471ED")
        );

        defaultCategories.forEach(defaultCategory -> {
            categoryRepository.findByName(defaultCategory.getName())
                    .ifPresentOrElse(
                            existing -> log.debug("分类已存在: {}", existing.getName()),
                            () -> {
                                Category saved = categoryRepository.save(defaultCategory);
                                log.info("创建默认分类: {} (ID={})", saved.getName(), saved.getId());
                            }
                    );
        });
    }

    /**
     * 创建分类对象的辅助方法
     */
    private Category createCategory(String name, String description, String color) {
        Category category = new Category();
        category.setName(name);
        category.setDescription(description);
        category.setColor(color);
        category.setCreatedAt(LocalDateTime.now());
        category.setUpdatedAt(LocalDateTime.now());
        category.setIsDeleted(false);
        return category;
    }
}