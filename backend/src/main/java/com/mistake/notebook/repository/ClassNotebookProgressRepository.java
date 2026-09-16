package com.mistake.notebook.repository;

import com.mistake.notebook.entity.ClassNotebookProgress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClassNotebookProgressRepository extends JpaRepository<ClassNotebookProgress, Long> {
    Optional<ClassNotebookProgress> findByNotebookIdAndStudentId(Long notebookId, Long studentId);
    List<ClassNotebookProgress> findByNotebookId(Long notebookId);
    List<ClassNotebookProgress> findByStudentId(Long studentId);
    void deleteByStudentId(Long studentId);
}
