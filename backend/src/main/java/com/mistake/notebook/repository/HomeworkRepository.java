package com.mistake.notebook.repository;

import com.mistake.notebook.entity.Homework;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HomeworkRepository extends JpaRepository<Homework, Long> {
    List<Homework> findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(Long teacherId);
    List<Homework> findByTeacherIdInAndIsDeletedFalseOrderByCreatedAtDesc(List<Long> teacherIds);
    List<Homework> findByClassIdAndIsDeletedFalseOrderByCreatedAtDesc(Long classId);
    List<Homework> findByClassIdInAndIsDeletedFalseOrderByCreatedAtDesc(List<Long> classIds);
    Optional<Homework> findByIdAndTeacherId(Long id, Long teacherId);
    void deleteByTeacherId(Long teacherId);
}
