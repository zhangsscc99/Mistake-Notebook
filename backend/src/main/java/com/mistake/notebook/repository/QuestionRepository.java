package com.mistake.notebook.repository;

import com.mistake.notebook.entity.Question;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 题目数据访问层
 */
@Repository
public interface QuestionRepository extends JpaRepository<Question, Long> {

    /**
     * 根据分类查询题目（未删除）
     */
    List<Question> findByCategoryAndIsDeletedFalseOrderByCreatedAtDesc(String category);

    /**
     * 根据难度查询题目（未删除）
     */
    List<Question> findByDifficultyAndIsDeletedFalseOrderByCreatedAtDesc(Question.DifficultyLevel difficulty);

    /**
     * 根据分类和难度查询题目（未删除）
     */
    List<Question> findByCategoryAndDifficultyAndIsDeletedFalseOrderByCreatedAtDesc(
            String category, Question.DifficultyLevel difficulty);

    /**
     * 查询所有未删除的题目
     */
    List<Question> findByIsDeletedFalseOrderByCreatedAtDesc();

    /**
     * 分页查询未删除的题目
     */
    Page<Question> findByIsDeletedFalse(Pageable pageable);

    /**
     * 根据分类分页查询题目（未删除）
     */
    Page<Question> findByCategoryAndIsDeletedFalse(String category, Pageable pageable);

    /**
     * 根据难度分页查询题目（未删除）
     */
    Page<Question> findByDifficultyAndIsDeletedFalse(Question.DifficultyLevel difficulty, Pageable pageable);

    /**
     * 根据内容关键词搜索题目（未删除）
     */
    @Query("SELECT q FROM Question q WHERE q.content LIKE %:keyword% AND q.isDeleted = false ORDER BY q.createdAt DESC")
    List<Question> findByContentContainingAndIsDeletedFalse(@Param("keyword") String keyword);

    /**
     * 根据标签查询题目（未删除）
     */
    @Query("SELECT q FROM Question q JOIN q.tags t WHERE t = :tag AND q.isDeleted = false ORDER BY q.createdAt DESC")
    List<Question> findByTagAndIsDeletedFalse(@Param("tag") String tag);

    /**
     * 统计各分类的题目数量
     */
    @Query("SELECT q.category, COUNT(q) FROM Question q WHERE q.isDeleted = false GROUP BY q.category")
    List<Object[]> countByCategory();

    /**
     * 统计各难度的题目数量
     */
    @Query("SELECT q.difficulty, COUNT(q) FROM Question q WHERE q.isDeleted = false GROUP BY q.difficulty")
    List<Object[]> countByDifficulty();

    /**
     * 根据ID列表查询题目（未删除）
     */
    List<Question> findByIdInAndIsDeletedFalseOrderByCreatedAtDesc(List<Long> ids);
} 