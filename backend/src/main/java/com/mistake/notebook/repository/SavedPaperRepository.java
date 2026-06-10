package com.mistake.notebook.repository;

import com.mistake.notebook.entity.SavedPaper;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SavedPaperRepository extends JpaRepository<SavedPaper, Long> {

    List<SavedPaper> findByIsDeletedFalseOrderByCreatedAtDesc();
}
