package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "pk_matches")
@Data
public class PkMatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "challenger_id", nullable = false)
    private Long challengerId;

    @Column(name = "opponent_id", nullable = false)
    private Long opponentId;

    @Column(name = "challenger_score", nullable = false)
    private Integer challengerScore = 0;

    @Column(name = "opponent_score", nullable = false)
    private Integer opponentScore = 0;

    @Column(name = "winner_id")
    private Long winnerId;

    @Column(nullable = false, length = 16)
    private String status = "PENDING";

    @Column(name = "snapshot_json", columnDefinition = "TEXT")
    private String snapshotJson = "";

    @Column(length = 16)
    private String mode = "POWER";

    @Column(name = "questions_json", columnDefinition = "TEXT")
    private String questionsJson = "";

    @Column(name = "challenger_answers", columnDefinition = "TEXT")
    private String challengerAnswers = "";

    @Column(name = "opponent_answers", columnDefinition = "TEXT")
    private String opponentAnswers = "";

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
