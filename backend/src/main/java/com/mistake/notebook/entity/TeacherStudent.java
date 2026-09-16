package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/** 教师与学生的绑定关系 */
@Entity
@Table(name = "teacher_students", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"teacher_id", "student_id"})
})
@Data
@EntityListeners(AuditingEntityListener.class)
public class TeacherStudent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "teacher_id", nullable = false)
    private Long teacherId;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "remark", length = 60)
    private String remark = "";

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
