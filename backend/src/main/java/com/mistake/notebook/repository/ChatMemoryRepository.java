package com.mistake.notebook.repository;

import com.mistake.notebook.entity.ChatMemory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * AI 答疑记忆数据访问层
 */
@Repository
public interface ChatMemoryRepository extends JpaRepository<ChatMemory, Long> {

    Optional<ChatMemory> findByClientId(String clientId);
}
