package com.mistake.notebook.repository;

import com.mistake.notebook.entity.CheckinPostLike;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CheckinPostLikeRepository extends JpaRepository<CheckinPostLike, Long> {
    Optional<CheckinPostLike> findByPostIdAndUserId(Long postId, Long userId);
    List<CheckinPostLike> findByUserIdAndPostIdIn(Long userId, List<Long> postIds);
    void deleteByUserId(Long userId);
    void deleteByPostId(Long postId);
}
