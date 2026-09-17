package com.mistake.notebook.repository;

import com.mistake.notebook.entity.TeacherClass;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TeacherClassRepository extends JpaRepository<TeacherClass, Long> {
    List<TeacherClass> findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(Long teacherId);
    Optional<TeacherClass> findByJoinCodeAndIsDeletedFalse(String joinCode);
    Optional<TeacherClass> findByIdAndTeacherIdAndIsDeletedFalse(Long id, Long teacherId);
    void deleteByTeacherId(Long teacherId);
}
