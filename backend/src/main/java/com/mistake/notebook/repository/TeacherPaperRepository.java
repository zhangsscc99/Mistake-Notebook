package com.mistake.notebook.repository;

import com.mistake.notebook.entity.TeacherPaper;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TeacherPaperRepository extends JpaRepository<TeacherPaper, Long> {
    List<TeacherPaper> findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(Long teacherId);
    List<TeacherPaper> findByTeacherIdAndClassIdAndIsDeletedFalseOrderByCreatedAtDesc(Long teacherId, Long classId);
    Optional<TeacherPaper> findByIdAndTeacherId(Long id, Long teacherId);
    void deleteByTeacherId(Long teacherId);
}
