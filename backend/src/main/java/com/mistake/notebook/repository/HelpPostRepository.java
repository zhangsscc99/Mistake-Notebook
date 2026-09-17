package com.mistake.notebook.repository;

import com.mistake.notebook.entity.HelpPost;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HelpPostRepository extends JpaRepository<HelpPost, Long> {
    List<HelpPost> findTop80ByOrderByCreatedAtDesc();
    List<HelpPost> findTop80BySubjectOrderByCreatedAtDesc(String subject);
    long countByUserId(Long userId);
    void deleteByUserId(Long userId);
}
