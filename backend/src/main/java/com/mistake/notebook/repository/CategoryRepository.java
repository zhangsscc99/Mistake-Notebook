package com.mistake.notebook.repository;

import com.mistake.notebook.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 分类数据访问层
 */
@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {

    /**
     * 根据名称查找分类
     */
    Optional<Category> findByName(String name);

    Optional<Category> findByUserIdAndNameAndIsDeleted(Long userId, String name, Boolean isDeleted);

    Optional<Category> findByNameAndIsDeleted(String name, Boolean isDeleted);

    @Query("SELECT c FROM Category c WHERE c.isDeleted = false ORDER BY c.id ASC")
    java.util.List<Category> findAllActive();

    java.util.List<Category> findByUserIdAndIsDeletedFalseOrderByIdAsc(Long userId);

    @Query("SELECT COUNT(c) FROM Category c WHERE c.isDeleted = false")
    long countActive();

    long countByUserIdAndIsDeletedFalse(Long userId);

    void deleteByUserId(Long userId);
}