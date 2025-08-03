package com.mistake.notebook.controller;

import com.mistake.notebook.dto.ApiResponse;
import com.mistake.notebook.dto.CreateQuestionRequest;
import com.mistake.notebook.dto.QuestionDTO;
import com.mistake.notebook.service.QuestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 题目REST控制器
 */
@RestController
@RequestMapping("/questions")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:3060", "http://127.0.0.1:3060", "http://localhost:3000", "http://127.0.0.1:3000"})
public class QuestionController {

    private final QuestionService questionService;

    /**
     * 创建题目
     */
    @PostMapping
    public ResponseEntity<ApiResponse<QuestionDTO>> createQuestion(
            @Valid @RequestBody CreateQuestionRequest request) {
        try {
            QuestionDTO question = questionService.createQuestion(request);
            return ResponseEntity.ok(ApiResponse.success("题目创建成功", question));
        } catch (Exception e) {
            log.error("创建题目失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("创建题目失败：" + e.getMessage()));
        }
    }

    /**
     * 根据ID查询题目
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<QuestionDTO>> getQuestionById(@PathVariable Long id) {
        return questionService.getQuestionById(id)
                .map(question -> ResponseEntity.ok(ApiResponse.success(question)))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("题目不存在")));
    }

    /**
     * 查询所有题目
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<QuestionDTO>>> getAllQuestions(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String difficulty,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String tag) {
        try {
            List<QuestionDTO> questions;

            if (keyword != null && !keyword.trim().isEmpty()) {
                questions = questionService.searchQuestions(keyword);
            } else if (tag != null && !tag.trim().isEmpty()) {
                questions = questionService.getQuestionsByTag(tag);
            } else if (category != null && difficulty != null) {
                questions = questionService.getQuestionsByCategoryAndDifficulty(category, difficulty);
            } else if (category != null) {
                questions = questionService.getQuestionsByCategory(category);
            } else if (difficulty != null) {
                questions = questionService.getQuestionsByDifficulty(difficulty);
            } else {
                questions = questionService.getAllQuestions();
            }

            return ResponseEntity.ok(ApiResponse.success(questions));
        } catch (Exception e) {
            log.error("查询题目失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("查询题目失败：" + e.getMessage()));
        }
    }

    /**
     * 分页查询题目
     */
    @GetMapping("/page")
    public ResponseEntity<ApiResponse<Page<QuestionDTO>>> getQuestionsPage(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        try {
            Page<QuestionDTO> questions = questionService.getQuestions(page, size, sortBy, sortDir);
            return ResponseEntity.ok(ApiResponse.success(questions));
        } catch (Exception e) {
            log.error("分页查询题目失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("查询题目失败：" + e.getMessage()));
        }
    }

    /**
     * 根据ID列表查询题目（用于试卷生成）
     */
    @PostMapping("/batch")
    public ResponseEntity<ApiResponse<List<QuestionDTO>>> getQuestionsByIds(
            @RequestBody List<Long> ids) {
        try {
            List<QuestionDTO> questions = questionService.getQuestionsByIds(ids);
            return ResponseEntity.ok(ApiResponse.success(questions));
        } catch (Exception e) {
            log.error("批量查询题目失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("查询题目失败：" + e.getMessage()));
        }
    }

    /**
     * 更新题目
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<QuestionDTO>> updateQuestion(
            @PathVariable Long id,
            @Valid @RequestBody CreateQuestionRequest request) {
        try {
            return questionService.updateQuestion(id, request)
                    .map(question -> ResponseEntity.ok(ApiResponse.success("题目更新成功", question)))
                    .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body(ApiResponse.error("题目不存在")));
        } catch (Exception e) {
            log.error("更新题目失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("更新题目失败：" + e.getMessage()));
        }
    }

    /**
     * 删除题目
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteQuestion(@PathVariable Long id) {
        try {
            boolean deleted = questionService.deleteQuestion(id);
            if (deleted) {
                return ResponseEntity.ok(ApiResponse.<Void>success("题目删除成功", null));
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.<Void>error("题目不存在"));
            }
        } catch (Exception e) {
            log.error("删除题目失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("删除题目失败：" + e.getMessage()));
        }
    }

    /**
     * 获取分类统计
     */
    @GetMapping("/statistics/category")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getCategoryStatistics() {
        try {
            Map<String, Long> statistics = questionService.getCategoryStatistics();
            return ResponseEntity.ok(ApiResponse.success(statistics));
        } catch (Exception e) {
            log.error("获取分类统计失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("获取统计数据失败：" + e.getMessage()));
        }
    }

    /**
     * 获取难度统计
     */
    @GetMapping("/statistics/difficulty")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getDifficultyStatistics() {
        try {
            Map<String, Long> statistics = questionService.getDifficultyStatistics();
            return ResponseEntity.ok(ApiResponse.success(statistics));
        } catch (Exception e) {
            log.error("获取难度统计失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("获取统计数据失败：" + e.getMessage()));
        }
    }

    /**
     * 根据分类ID获取题目列表
     */
    @GetMapping("/by-category/{categoryId}")
    public ResponseEntity<ApiResponse<List<QuestionDTO>>> getQuestionsByCategory(@PathVariable Long categoryId) {
        try {
            List<QuestionDTO> questions = questionService.getQuestionsByCategory(categoryId);
            log.info("根据分类ID {} 获取到 {} 道题目", categoryId, questions.size());
            return ResponseEntity.ok(ApiResponse.success("获取题目列表成功", questions));
        } catch (Exception e) {
            log.error("根据分类获取题目失败，分类ID: {}", categoryId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("获取题目失败：" + e.getMessage()));
        }
    }
} 