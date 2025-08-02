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
} 