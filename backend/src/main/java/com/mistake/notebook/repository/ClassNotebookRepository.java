package com.mistake.notebook.repository;

import com.mistake.notebook.entity.ClassNotebook;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClassNotebookRepository extends JpaRepository<ClassNotebook, Long> {
    List<ClassNotebook> findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(Long teacherId);
    List<ClassNotebook> findByTeacherIdInAndIsDeletedFalseAndPushedAtIsNotNullOrderByPushedAtDesc(List<Long> teacherIds);
    Optional<ClassNotebook> findByIdAndTeacherId(Long id, Long teacherId);
    void deleteByTeacherId(Long teacherId);
}
