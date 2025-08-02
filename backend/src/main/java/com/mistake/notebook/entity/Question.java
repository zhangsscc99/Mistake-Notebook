package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 题目实体类
 */
@Entity
@Table(name = "questions")
@Data
@EqualsAndHashCode(callSuper = false)
@EntityListeners(AuditingEntityListener.class)
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 题目内容
     */
    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    /**
     * 题目图片URL
     */
    @Column(name = "image_url")
    private String imageUrl;

    /**
     * 题目分类
     */
    @Column(nullable = false, length = 50)
    private String category;

    /**
     * 难度等级：easy, medium, hard
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DifficultyLevel difficulty;

    /**
     * 标签列表
     */
    @ElementCollection
    @CollectionTable(name = "question_tags", joinColumns = @JoinColumn(name = "question_id"))
    @Column(name = "tag")
    private List<String> tags;

    /**
     * OCR识别置信度
     */
    @Column(name = "ocr_confidence")
    private Double ocrConfidence;

    /**
     * AI分类置信度
     */
    @Column(name = "ai_confidence")
    private Double aiConfidence;

    /**
     * 是否已删除
     */
    @Column(name = "is_deleted")
    private Boolean isDeleted = false;

    /**
     * 创建时间
     */
    @CreatedDate
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 难度等级枚举
     */
    public enum DifficultyLevel {
        EASY("简单"),
        MEDIUM("中等"),
        HARD("困难");

        private final String description;

        DifficultyLevel(String description) {
            this.description = description;
        }

        public String getDescription() {
            return description;
        }
    }
} 