package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/** 针对单道错题的 AI 讲解（与通用对话助手区分） */
@Entity
@Table(name = "question_explanations", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "question_id"})
})
@Data
@EntityListeners(AuditingEntityListener.class)
public class QuestionExplanation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "question_id", nullable = false)
    private Long questionId;

    @Column(columnDefinition = "LONGTEXT")
    private String content = "";

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
