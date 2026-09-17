package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/** 学生提交的作业 */
@Entity
@Table(name = "homework_submissions", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"homework_id", "student_id"})
})
@Data
@EntityListeners(AuditingEntityListener.class)
public class HomeworkSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "homework_id", nullable = false)
    private Long homeworkId;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    /** ["答案1", "答案2", ...] */
    @Column(name = "answers_json", columnDefinition = "LONGTEXT")
    private String answersJson = "[]";

    /** SUBMITTED / GRADED */
    @Column(length = 16, nullable = false)
    private String status = "SUBMITTED";

    @Column(name = "score")
    private Integer score;

    /** 每题得分 [..] */
    @Column(name = "item_scores_json", columnDefinition = "TEXT")
    private String itemScoresJson = "[]";

    @Column(columnDefinition = "TEXT")
    private String feedback = "";

    /** ["right","wrong",...] 与小程序作业批改对/错标记对齐 */
    @Column(name = "marks_json", columnDefinition = "TEXT")
    private String marksJson = "[]";

    /** AI 自动批改建议 */
    @Column(name = "ai_feedback", columnDefinition = "LONGTEXT")
    private String aiFeedback = "";

    @Column(name = "graded_at")
    private LocalDateTime gradedAt;

    @CreatedDate
    @Column(name = "submitted_at", nullable = false, updatable = false)
    private LocalDateTime submittedAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
