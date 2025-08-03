package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 分类实体类
 */
@Entity
@Table(name = "categories")
@Data
@EqualsAndHashCode(callSuper = false)
@EntityListeners(AuditingEntityListener.class)
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 分类名称
     */
    @Column(name = "name", length = 50, nullable = false, unique = true)
    private String name;

    /**
     * 分类描述
     */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /**
     * 分类颜色 (用于前端显示)
     */
    @Column(name = "color", length = 20)
    private String color = "#E8A855"; // 默认金色主题

    /**
     * 该分类下的题目数量
     */
    @Column(name = "question_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private Integer questionCount = 0;

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
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * 是否已删除（软删除）
     */
    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;
}