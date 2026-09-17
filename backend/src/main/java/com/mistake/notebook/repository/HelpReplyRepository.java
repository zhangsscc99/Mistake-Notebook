package com.mistake.notebook.repository;

import com.mistake.notebook.entity.HelpReply;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HelpReplyRepository extends JpaRepository<HelpReply, Long> {
    List<HelpReply> findByPostIdOrderByCreatedAtAsc(Long postId);
    void deleteByUserId(Long userId);
    void deleteByPostId(Long postId);
}
