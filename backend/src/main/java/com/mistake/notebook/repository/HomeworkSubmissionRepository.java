package com.mistake.notebook.repository;

import com.mistake.notebook.entity.HomeworkSubmission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HomeworkSubmissionRepository extends JpaRepository<HomeworkSubmission, Long> {
    Optional<HomeworkSubmission> findByHomeworkIdAndStudentId(Long homeworkId, Long studentId);
    List<HomeworkSubmission> findByHomeworkIdOrderBySubmittedAtDesc(Long homeworkId);
    List<HomeworkSubmission> findByStudentId(Long studentId);
    long countByHomeworkId(Long homeworkId);
    long countByHomeworkIdAndStatus(Long homeworkId, String status);
    void deleteByStudentId(Long studentId);
}
