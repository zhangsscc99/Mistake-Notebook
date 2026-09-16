package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/** 师生留言 */
@Entity
@Table(name = "teacher_messages")
@Data
@EntityListeners(AuditingEntityListener.class)
public class TeacherMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "teacher_id", nullable = false)
    private Long teacherId;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    /** TEACHER / STUDENT */
    @Column(name = "sender_role", nullable = false, length = 16)
    private String senderRole;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
