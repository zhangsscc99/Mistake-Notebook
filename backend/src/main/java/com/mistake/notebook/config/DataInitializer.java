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
        // 检查是否已经有活跃的分类数据
        long categoryCount = categoryRepository.countActive();
        if (categoryCount > 0) {
            log.info("分类数据已存在，跳过初始化。当前活跃分类数量: {}", categoryCount);
            return;
        }

        log.info("开始初始化默认分类数据...");
        
        // 创建默认分类列表（让数据库自动生成ID）
        List<Category> defaultCategories = Arrays.asList(
            createCategory("数学", "数学相关题目", "#E8A855"),
            createCategory("物理", "物理相关题目", "#4A90E2"),
            createCategory("化学", "化学相关题目", "#7ED321"),
            createCategory("英语", "英语相关题目", "#F5A623"),
            createCategory("语文", "语文相关题目", "#BD10E0"),
            createCategory("生物", "生物相关题目", "#50E3C2"),
            createCategory("历史", "历史相关题目", "#D0021B"),
            createCategory("地理", "地理相关题目", "#8B572A")
        );

        // 批量保存分类
        try {
            List<Category> savedCategories = categoryRepository.saveAll(defaultCategories);
            log.info("成功初始化 {} 个默认分类", savedCategories.size());
            
            // 打印初始化的分类信息
            savedCategories.forEach(category -> 
                log.debug("初始化分类: ID={}, 名称={}, 描述={}", 
                    category.getId(), category.getName(), category.getDescription())
            );
            
        } catch (Exception e) {
            log.error("初始化默认分类失败", e);
            throw new RuntimeException("数据初始化失败", e);
        }
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