package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "help_posts")
@Data
public class HelpPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "nick_name", length = 40)
    private String nickName = "";

    @Column(length = 20)
    private String subject = "";

    @Column(nullable = false, length = 80)
    private String title;

    @Column(nullable = false, length = 800)
    private String content;

    @Column(length = 200)
    private String snippet = "";

    @Column(name = "question_id")
    private Long questionId;

    @Column(name = "like_count", nullable = false)
    private Integer likeCount = 0;

    @Column(name = "reply_count", nullable = false)
    private Integer replyCount = 0;

    @Column(nullable = false)
    private Boolean seeded = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
