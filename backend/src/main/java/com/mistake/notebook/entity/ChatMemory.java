package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * AI 答疑记忆（SQL 持久化）。
 * 以 clientId 维度保存每位用户的长期记忆：近期提问、知识主题、对话摘要。
 */
@Entity
@Table(name = "chat_memory", indexes = {
        @Index(name = "idx_chat_memory_client", columnList = "client_id", unique = true)
})
@Data
@EqualsAndHashCode(callSuper = false)
@EntityListeners(AuditingEntityListener.class)
public class ChatMemory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 客户端标识（网页端用 localStorage 生成的 UUID）
     */
    @Column(name = "client_id", length = 64, nullable = false, unique = true)
    private String clientId;

    /**
     * 对话长期摘要
     */
    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    /**
     * 知识主题（JSON 数组字符串）
     */
    @Column(name = "topics", columnDefinition = "TEXT")
    private String topics;

    /**
     * 近期提问（JSON 数组字符串）
     */
    @Column(name = "last_questions", columnDefinition = "TEXT")
    private String lastQuestions;

    /**
     * 最近一次的题目上下文
     */
    @Column(name = "last_question_context", columnDefinition = "TEXT")
    private String lastQuestionContext;

    /**
     * 累计对话会话数
     */
    @Column(name = "session_count")
    private Integer sessionCount = 0;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
