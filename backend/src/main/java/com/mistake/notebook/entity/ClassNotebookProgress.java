package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/** 学生练习班级错题本的进度 */
@Entity
@Table(name = "class_notebook_progress", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"notebook_id", "student_id"})
})
@Data
@EntityListeners(AuditingEntityListener.class)
public class ClassNotebookProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "notebook_id", nullable = false)
    private Long notebookId;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "done_count", nullable = false)
    private Integer doneCount = 0;

    @Column(name = "mastered_count", nullable = false)
    private Integer masteredCount = 0;

    @Column(name = "total_count", nullable = false)
    private Integer totalCount = 0;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
