package com.mistake.notebook.repository;

import com.mistake.notebook.entity.MistakeReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MistakeReportRepository extends JpaRepository<MistakeReport, Long> {
    List<MistakeReport> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<MistakeReport> findByIdAndUserId(Long id, Long userId);
    long countByUserId(Long userId);

    void deleteByUserId(Long userId);
}
