package com.mistake.notebook.repository;

import com.mistake.notebook.entity.QuestionExplanation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface QuestionExplanationRepository extends JpaRepository<QuestionExplanation, Long> {
    Optional<QuestionExplanation> findByUserIdAndQuestionId(Long userId, Long questionId);
    long countByUserId(Long userId);
    void deleteByUserId(Long userId);
}
