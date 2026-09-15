package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "question_notes", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "question_id"})
})
@Data
@EntityListeners(AuditingEntityListener.class)
public class QuestionNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "question_id", nullable = false)
    private Long questionId;

    @Column(columnDefinition = "TEXT")
    private String content = "";

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
