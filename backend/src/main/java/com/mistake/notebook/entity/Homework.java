package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/** 教师布置的作业 */
@Entity
@Table(name = "homeworks")
@Data
@EntityListeners(AuditingEntityListener.class)
public class Homework {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "teacher_id", nullable = false)
    private Long teacherId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description = "";

    /** [{content, answer, analysis, score}] */
    @Column(name = "questions_json", columnDefinition = "LONGTEXT", nullable = false)
    private String questionsJson = "[]";

    @Column(name = "question_count", nullable = false)
    private Integer questionCount = 0;

    /** 指定学生 id，逗号分隔；空 = 全部名下学生 */
    @Column(name = "student_ids", columnDefinition = "TEXT")
    private String studentIds = "";

    @Column(name = "due_at")
    private LocalDateTime dueAt;

    @Column(name = "is_deleted")
    private Boolean isDeleted = false;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
