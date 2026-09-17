package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/** 教师为学生生成的家长端报告 */
@Entity
@Table(name = "parent_reports")
@Data
@EntityListeners(AuditingEntityListener.class)
public class ParentReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "teacher_id", nullable = false)
    private Long teacherId;

    /** 0 = 班级学情报告（非单学生） */
    @Column(name = "student_id", nullable = false)
    private Long studentId = 0L;

    @Column(name = "class_id")
    private Long classId;

    @Column(name = "snapshot_json", columnDefinition = "LONGTEXT")
    private String snapshotJson = "";

    @Column(nullable = false, length = 120)
    private String title;

    @Column(columnDefinition = "LONGTEXT")
    private String content = "";

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
