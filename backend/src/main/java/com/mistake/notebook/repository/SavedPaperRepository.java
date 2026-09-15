package com.mistake.notebook.repository;

import com.mistake.notebook.entity.SavedPaper;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedPaperRepository extends JpaRepository<SavedPaper, Long> {

    List<SavedPaper> findByIsDeletedFalseOrderByCreatedAtDesc();

    List<SavedPaper> findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(Long userId);

    Optional<SavedPaper> findByIdAndUserId(Long id, Long userId);

    long countByUserIdAndIsDeletedFalse(Long userId);

    void deleteByUserId(Long userId);
}
