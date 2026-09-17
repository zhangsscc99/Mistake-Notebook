package com.mistake.notebook.repository;

import com.mistake.notebook.entity.HelpPostLike;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface HelpPostLikeRepository extends JpaRepository<HelpPostLike, Long> {
    Optional<HelpPostLike> findByPostIdAndUserId(Long postId, Long userId);
    void deleteByPostId(Long postId);
    void deleteByUserId(Long userId);
}
