package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@EntityListeners(AuditingEntityListener.class)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 40)
    private String username;

    @Column(name = "password_salt", nullable = false, length = 64)
    private String passwordSalt;

    @Column(name = "password_hash", nullable = false, length = 128)
    private String passwordHash;

    @Column(name = "nick_name", length = 20)
    private String nickName = "匿名用户";

    @Column(name = "avatar_url", columnDefinition = "TEXT")
    private String avatarUrl = "";

    @Column(length = 20)
    private String stage = "";

    @Column(nullable = false)
    private Integer coins = 0;

    @Column(name = "vip_expire_at", length = 40)
    private String vipExpireAt = "";

    @Column(name = "checkin_streak", nullable = false)
    private Integer checkinStreak = 0;

    @Column(name = "checkin_last_day", length = 16)
    private String checkinLastDay = "";

    @Column(name = "checkin_total_days", nullable = false)
    private Integer checkinTotalDays = 0;

    @Column(name = "leaderboard_public", nullable = false)
    private Boolean leaderboardPublic = false;

    @Column(name = "chat_day_key", length = 16)
    private String chatDayKey = "";

    @Column(name = "chat_used_count", nullable = false)
    private Integer chatUsedCount = 0;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
