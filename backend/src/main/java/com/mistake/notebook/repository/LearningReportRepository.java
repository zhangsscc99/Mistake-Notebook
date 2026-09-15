package com.mistake.notebook.repository;

import com.mistake.notebook.entity.LearningReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LearningReportRepository extends JpaRepository<LearningReport, Long> {
    List<LearningReport> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<LearningReport> findByIdAndUserId(Long id, Long userId);
    long countByUserId(Long userId);

    void deleteByUserId(Long userId);
}
