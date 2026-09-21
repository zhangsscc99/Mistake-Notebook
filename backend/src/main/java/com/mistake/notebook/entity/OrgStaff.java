package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "org_staff", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"org_id", "teacher_id"})
})
@Data
public class OrgStaff {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "org_id", nullable = false)
    private Long orgId;

    @Column(name = "teacher_id", nullable = false)
    private Long teacherId;

    /** OWNER / ADMIN */
    @Column(nullable = false, length = 16)
    private String role = "ADMIN";

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
