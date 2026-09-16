package com.mistake.notebook.repository;

import com.mistake.notebook.entity.ParentReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ParentReportRepository extends JpaRepository<ParentReport, Long> {
    List<ParentReport> findByTeacherIdAndStudentIdOrderByCreatedAtDesc(Long teacherId, Long studentId);
    List<ParentReport> findByStudentIdOrderByCreatedAtDesc(Long studentId);
    Optional<ParentReport> findByIdAndTeacherId(Long id, Long teacherId);
    void deleteByStudentId(Long studentId);
    void deleteByTeacherId(Long teacherId);
}
