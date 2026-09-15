package com.mistake.notebook.repository;

import com.mistake.notebook.entity.QuestionNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QuestionNoteRepository extends JpaRepository<QuestionNote, Long> {
    Optional<QuestionNote> findByUserIdAndQuestionId(Long userId, Long questionId);
    List<QuestionNote> findByUserIdAndQuestionIdIn(Long userId, List<Long> questionIds);
    long countByUserId(Long userId);

    void deleteByUserId(Long userId);
}
