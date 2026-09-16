package com.mistake.notebook.repository;

import com.mistake.notebook.entity.CheckinPost;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CheckinPostRepository extends JpaRepository<CheckinPost, Long> {
    List<CheckinPost> findTop80ByOrderByCreatedAtDesc();
    Optional<CheckinPost> findByUserIdAndDayKey(Long userId, String dayKey);
    void deleteByUserId(Long userId);
}
