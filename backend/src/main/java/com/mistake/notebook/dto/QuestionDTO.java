package com.mistake.notebook.dto;

import com.mistake.notebook.entity.Question;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 题目数据传输对象
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class QuestionDTO {

    private Long id;
    private String content;
    private String imageUrl;
    private String category;
    private String difficulty;
    private List<String> tags;
    private Double ocrConfidence;
    private Double aiConfidence;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /**
     * 从实体转换为DTO
     */
    public static QuestionDTO fromEntity(Question question) {
        QuestionDTO dto = new QuestionDTO();
        dto.setId(question.getId());
        dto.setContent(question.getContent());
        dto.setImageUrl(question.getImageUrl());
        dto.setCategory(question.getCategory());
        dto.setDifficulty(question.getDifficulty().name().toLowerCase());
        dto.setTags(question.getTags());
        dto.setOcrConfidence(question.getOcrConfidence());
        dto.setAiConfidence(question.getAiConfidence());
        dto.setCreatedAt(question.getCreatedAt());
        dto.setUpdatedAt(question.getUpdatedAt());
        return dto;
    }

    /**
     * 转换为实体（用于新建）
     */
    public Question toEntity() {
        Question question = new Question();
        question.setContent(this.content);
        question.setImageUrl(this.imageUrl);
        question.setCategory(this.category);
        
        // 设置默认分类ID，避免NOT NULL约束错误
        question.setCategoryId(mapCategoryToId(this.category));
        
        // 解析难度等级
        if (this.difficulty != null) {
            try {
                question.setDifficulty(Question.DifficultyLevel.valueOf(this.difficulty.toUpperCase()));
            } catch (IllegalArgumentException e) {
                question.setDifficulty(Question.DifficultyLevel.MEDIUM); // 默认中等难度
            }
        } else {
            question.setDifficulty(Question.DifficultyLevel.MEDIUM);
        }
        
        question.setTags(this.tags);
        question.setOcrConfidence(this.ocrConfidence);
        question.setAiConfidence(this.aiConfidence);
        question.setIsDeleted(false);
        
        return question;
    }

    /**
     * 将分类名称映射为分类ID
     * 暂时使用简单的映射逻辑，避免数据库NOT NULL约束错误
     * TODO: 后续应该注入CategoryRepository来动态查询分类ID
     */
    private Long mapCategoryToId(String categoryName) {
        // 暂时使用固定映射，避免外键约束问题
        // 注意：这假设数据库中分类的插入顺序和ID生成是可预测的
        if (categoryName == null) {
            return 1L; // 默认第一个分类（通常是数学）
        }
        
        // 根据分类名称映射到预期的ID（基于初始化顺序）
        switch (categoryName.toLowerCase()) {
            case "math":
            case "mathematics": 
            case "数学":
                return 1L; // 数学通常是第一个插入的
            case "physics":
            case "物理":
                return 2L;
            case "chemistry":
            case "化学":
                return 3L;
            case "english":
            case "英语":
                return 4L;
            case "chinese":
            case "语文":
                return 5L;
            case "biology":
            case "生物":
                return 6L;
            case "history":
            case "历史":
                return 7L;
            case "geography":
            case "地理":
                return 8L;
            case "computer":
            case "计算机":
            case "编程":
            case "计算机/编程":
                return 9L;
            case "politics":
            case "政治":
                return 10L;
            default:
                return 1L; // 默认数学分类
        }
    }
} 