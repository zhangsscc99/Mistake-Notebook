package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "saved_papers")
@Data
@EqualsAndHashCode(callSuper = false)
@EntityListeners(AuditingEntityListener.class)
public class SavedPaper {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "question_count", nullable = false)
    private Integer questionCount;

    @Column(nullable = false)
    private Integer duration = 90;

    @Column(name = "total_score", nullable = false)
    private Integer totalScore;

    @Column(name = "questions_json", columnDefinition = "TEXT", nullable = false)
    private String questionsJson;

    @Column(name = "is_deleted")
    private Boolean isDeleted = false;

    @CreatedDate
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
