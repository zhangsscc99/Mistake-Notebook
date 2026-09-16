package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/** 班级错题本：教师整理的高频错题集合，推送给名下学生练习 */
@Entity
@Table(name = "class_notebooks")
@Data
@EntityListeners(AuditingEntityListener.class)
public class ClassNotebook {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "teacher_id", nullable = false)
    private Long teacherId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description = "";

    /** [{content, answer, analysis, category, difficulty, tags, sourceCount}] */
    @Column(name = "questions_json", columnDefinition = "LONGTEXT", nullable = false)
    private String questionsJson = "[]";

    @Column(name = "question_count", nullable = false)
    private Integer questionCount = 0;

    @Column(name = "pushed_at")
    private LocalDateTime pushedAt;

    @Column(name = "is_deleted")
    private Boolean isDeleted = false;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
