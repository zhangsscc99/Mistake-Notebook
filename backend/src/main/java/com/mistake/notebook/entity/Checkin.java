package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "checkins", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "day_key"})
})
@Data
public class Checkin {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "day_key", nullable = false, length = 16)
    private String dayKey;

    @Column(nullable = false)
    private Integer coins = 0;

    @Column(length = 80)
    private String reason = "checkin";
}
