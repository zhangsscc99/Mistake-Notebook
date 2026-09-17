package com.mistake.notebook.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "organizations", uniqueConstraints = {
        @UniqueConstraint(columnNames = "slug"),
        @UniqueConstraint(columnNames = "owner_id")
})
@Data
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40)
    private String slug;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(name = "short_name", length = 20)
    private String shortName = "";

    @Column(length = 40)
    private String city = "";

    @Column(length = 8)
    private String mark = "";

    @Column(length = 200)
    private String tagline = "";

    @Column(length = 200)
    private String headline = "";

    @Column(columnDefinition = "TEXT")
    private String pitch = "";

    @Column(name = "logo_url", columnDefinition = "TEXT")
    private String logoUrl = "";

    @Column(name = "primary_color", length = 16)
    private String primaryColor = "#2459ff";

    @Column(name = "accent_color", length = 16)
    private String accentColor = "#52b7ff";

    @Column(name = "owner_id")
    private Long ownerId;

    @Column(nullable = false)
    private Boolean demo = false;

    @Column(length = 400)
    private String quote = "";

    @Column(name = "quote_by", length = 80)
    private String quoteBy = "";

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
