package com.mistake.notebook.repository;

import com.mistake.notebook.entity.TeacherStudent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TeacherStudentRepository extends JpaRepository<TeacherStudent, Long> {
    List<TeacherStudent> findByTeacherIdOrderByCreatedAtDesc(Long teacherId);
    List<TeacherStudent> findByStudentId(Long studentId);
    Optional<TeacherStudent> findByTeacherIdAndStudentId(Long teacherId, Long studentId);
    long countByTeacherId(Long teacherId);
    void deleteByStudentId(Long studentId);
    void deleteByTeacherId(Long teacherId);
}
