package com.mistake.notebook.controller;

import com.mistake.notebook.dto.ApiResponse;
import com.mistake.notebook.entity.Category;
import com.mistake.notebook.repository.CategoryRepository;
import com.mistake.notebook.repository.QuestionRepository;
import com.mistake.notebook.security.AuthContext;
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
    private final com.mistake.notebook.service.CategorySeedService categorySeedService;

    /**
     * 获取所有分类列表（包含题目数量）
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getAllCategories() {
        try {
            List<Category> categories = categorySeedService.listForUser(AuthContext.requireUserId());
            
            List<Map<String, Object>> categoryList = categories.stream().map(category -> {
                return toCategoryData(category);
            }).collect(Collectors.toList());

            return ResponseEntity.ok(ApiResponse.success("获取分类列表成功", categoryList));
        } catch (Exception e) {
            log.error("获取分类列表失败", e);
            return ResponseEntity.status(500)
                    .body(ApiResponse.error("获取分类列表失败：" + e.getMessage()));
        }
    }

    /**
     * 获取分类详情
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCategoryById(@PathVariable Long id) {
        try {
            return categoryRepository.findById(id)
                    .filter(category -> !Boolean.TRUE.equals(category.getIsDeleted()))
                    .filter(category -> java.util.Objects.equals(category.getUserId(), AuthContext.requireUserId()))
                    .map(category -> ResponseEntity.ok(ApiResponse.success("获取分类详情成功", toCategoryData(category))))
                    .orElse(ResponseEntity.status(404).body(ApiResponse.error("分类不存在")));
        } catch (Exception e) {
            log.error("获取分类详情失败，分类ID: {}", id, e);
            return ResponseEntity.status(500)
                    .body(ApiResponse.error("获取分类详情失败：" + e.getMessage()));
        }
    }

    /**
     * 获取分类统计信息
     */
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCategoryStats() {
        try {
            long userId = AuthContext.requireUserId();
            Map<String, Object> stats = new HashMap<>();
            long totalQuestions = questionRepository.countByUserIdAndIsDeleted(userId, false);
            stats.put("totalQuestions", totalQuestions);
            long totalCategories = categorySeedService.listForUser(userId).size();
            stats.put("totalCategories", totalCategories);
            LocalDateTime todayStart = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);
            long todayAdded = questionRepository.countByUserIdAndCreatedAtAfterAndIsDeleted(userId, todayStart, false);
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
                return "数";
            case "物理":
                return "物";
            case "化学":
                return "化";
            case "英语":
                return "英";
            case "语文":
                return "语";
            case "生物":
                return "生";
            case "历史":
                return "史";
            case "地理":
                return "地";
            case "计算机/编程":
                return "码";
            case "政治":
                return "政";
            default:
                return "题";
        }
    }

    private Map<String, Object> toCategoryData(Category category) {
        long questionCount = questionRepository.countByUserIdAndCategoryIdAndIsDeleted(
                AuthContext.requireUserId(), category.getId(), false);

        Map<String, Object> categoryData = new HashMap<>();
        categoryData.put("id", category.getId());
        categoryData.put("name", category.getName());
        categoryData.put("description", category.getDescription());
        categoryData.put("color", category.getColor());
        categoryData.put("questionCount", questionCount);
        categoryData.put("icon", getCategoryIcon(category.getName()));
        categoryData.put("createdAt", category.getCreatedAt());
        categoryData.put("updatedAt", category.getUpdatedAt());

        return categoryData;
    }
}
