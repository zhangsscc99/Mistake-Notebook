package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "checkin_posts", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "day_key"})
})
@Data
public class CheckinPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "day_key", nullable = false, length = 16)
    private String dayKey;

    @Column(length = 160)
    private String content = "";

    @Column(nullable = false)
    private Integer streak = 0;

    @Column(name = "total_days", nullable = false)
    private Integer totalDays = 0;

    @Column(name = "question_count", nullable = false)
    private Integer questionCount = 0;

    @Column(name = "like_count", nullable = false)
    private Integer likeCount = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
