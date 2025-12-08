package com.mistake.notebook.controller;

import com.mistake.notebook.dto.ApiResponse;
import com.mistake.notebook.entity.Category;
import com.mistake.notebook.repository.CategoryRepository;
import com.mistake.notebook.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 分类REST控制器
 */
@RestController
@RequestMapping("/categories")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:3060", "http://127.0.0.1:3060", "http://localhost:3000", "http://127.0.0.1:3000", "http://103.146.124.206:3060", "http://103.146.124.206:3000", "*"})
public class CategoryController {

    private final CategoryRepository categoryRepository;
    private final QuestionRepository questionRepository;

    /**
     * 获取所有分类列表（包含题目数量）
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getAllCategories() {
        try {
            List<Category> categories = categoryRepository.findAllActive();
            
            List<Map<String, Object>> categoryList = categories.stream().map(category -> {
                // 统计该分类下的题目数量
                long questionCount = questionRepository.countByCategoryIdAndIsDeleted(category.getId(), false);
                
                Map<String, Object> categoryData = new HashMap<>();
                categoryData.put("id", category.getId());
                categoryData.put("name", category.getName());
                categoryData.put("description", category.getDescription());
                categoryData.put("color", category.getColor());
                categoryData.put("questionCount", questionCount);
                categoryData.put("icon", getCategoryIcon(category.getName()));
                
                return categoryData;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(ApiResponse.success("获取分类列表成功", categoryList));
        } catch (Exception e) {
            log.error("获取分类列表失败", e);
            return ResponseEntity.status(500)
                    .body(ApiResponse.error("获取分类列表失败：" + e.getMessage()));
        }
    }

    /**
     * 获取分类统计信息
     */
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCategoryStats() {
        try {
            Map<String, Object> stats = new HashMap<>();
            
            // 总题目数
            long totalQuestions = questionRepository.countByIsDeleted(false);
            stats.put("totalQuestions", totalQuestions);
            
            // 分类数
            long totalCategories = categoryRepository.countActive();
            stats.put("totalCategories", totalCategories);
            
            // 今日新增题目数（简化版 - 统计今天创建的题目）
            LocalDateTime todayStart = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);
            long todayAdded = questionRepository.countByCreatedAtAfterAndIsDeleted(todayStart, false);
            stats.put("todayAdded", todayAdded);
            
            log.info("分类统计信息：总题目={}, 分类数={}, 今日新增={}", totalQuestions, totalCategories, todayAdded);
            
            return ResponseEntity.ok(ApiResponse.success("获取统计信息成功", stats));
        } catch (Exception e) {
            log.error("获取统计信息失败", e);
            return ResponseEntity.status(500)
                    .body(ApiResponse.error("获取统计信息失败：" + e.getMessage()));
        }
    }

    /**
     * 根据分类名称获取对应的图标
     */
    private String getCategoryIcon(String categoryName) {
        switch (categoryName) {
            case "数学":
                return "📐";
            case "物理":
                return "⚡";
            case "化学":
                return "🧪";
            case "英语":
                return "🇬🇧";
            case "语文":
                return "📚";
            case "生物":
                return "🌱";
            case "历史":
                return "🏛️";
            case "地理":
                return "🌍";
            case "计算机/编程":
                return "💻";
            case "政治":
                return "🗳️";
            default:
                return "📖";
        }
    }
}