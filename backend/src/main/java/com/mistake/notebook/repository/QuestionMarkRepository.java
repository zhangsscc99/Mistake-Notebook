package com.mistake.notebook.repository;

import com.mistake.notebook.entity.QuestionMark;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QuestionMarkRepository extends JpaRepository<QuestionMark, Long> {
    Optional<QuestionMark> findByUserIdAndQuestionId(Long userId, Long questionId);
    List<QuestionMark> findByUserIdAndQuestionIdIn(Long userId, List<Long> questionIds);
    long countByUserIdAndFavoriteTrue(Long userId);
    long countByUserIdAndPinnedTrue(Long userId);
    long countByUserIdAndMasteredTrue(Long userId);

    void deleteByUserId(Long userId);
}
