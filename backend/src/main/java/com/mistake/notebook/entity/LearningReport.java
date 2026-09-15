package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "learning_reports")
@Data
@EntityListeners(AuditingEntityListener.class)
public class LearningReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 80)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String overview = "";

    @Column(columnDefinition = "LONGTEXT")
    private String content = "";

    @Column(name = "question_count")
    private Integer questionCount = 0;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
