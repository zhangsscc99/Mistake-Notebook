package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "teacher_papers")
@Data
@EntityListeners(AuditingEntityListener.class)
public class TeacherPaper {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "teacher_id", nullable = false)
    private Long teacherId;

    @Column(name = "class_id")
    private Long classId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(name = "question_ids", columnDefinition = "TEXT")
    private String questionIds = "";

    @Column(name = "question_count")
    private Integer questionCount = 0;

    @Column
    private Integer duration = 90;

    @Column(name = "is_deleted")
    private Boolean isDeleted = false;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
