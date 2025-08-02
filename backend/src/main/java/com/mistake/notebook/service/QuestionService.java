package com.mistake.notebook.service;

import com.mistake.notebook.dto.CreateQuestionRequest;
import com.mistake.notebook.dto.QuestionDTO;
import com.mistake.notebook.entity.Question;
import com.mistake.notebook.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 题目业务服务层
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class QuestionService {

    private final QuestionRepository questionRepository;

    /**
     * 创建题目
     */
    @Transactional
    public QuestionDTO createQuestion(CreateQuestionRequest request) {
        log.info("创建题目：{}", request.getContent().substring(0, Math.min(50, request.getContent().length())));
        
        QuestionDTO dto = new QuestionDTO();
        dto.setContent(request.getContent());
        dto.setImageUrl(request.getImageUrl());
        dto.setCategory(request.getCategory());
        dto.setDifficulty(request.getDifficulty());
        dto.setTags(request.getTags());
        dto.setOcrConfidence(request.getOcrConfidence());
        dto.setAiConfidence(request.getAiConfidence());
        
        Question question = dto.toEntity();
        Question savedQuestion = questionRepository.save(question);
        
        log.info("题目创建成功，ID：{}", savedQuestion.getId());
        return QuestionDTO.fromEntity(savedQuestion);
    }

    /**
     * 根据ID查询题目
     */
    public Optional<QuestionDTO> getQuestionById(Long id) {
        return questionRepository.findById(id)
                .filter(question -> !question.getIsDeleted())
                .map(QuestionDTO::fromEntity);
    }

    /**
     * 查询所有题目
     */
    public List<QuestionDTO> getAllQuestions() {
        return questionRepository.findByIsDeletedFalseOrderByCreatedAtDesc()
                .stream()
                .map(QuestionDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * 分页查询题目
     */
    public Page<QuestionDTO> getQuestions(int page, int size, String sortBy, String sortDir) {
        Sort sort = Sort.by(Sort.Direction.fromString(sortDir), sortBy);
        Pageable pageable = PageRequest.of(page, size, sort);
        
        return questionRepository.findByIsDeletedFalse(pageable)
                .map(QuestionDTO::fromEntity);
    }

    /**
     * 根据分类查询题目
     */
    public List<QuestionDTO> getQuestionsByCategory(String category) {
        return questionRepository.findByCategoryAndIsDeletedFalseOrderByCreatedAtDesc(category)
                .stream()
                .map(QuestionDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * 根据难度查询题目
     */
    public List<QuestionDTO> getQuestionsByDifficulty(String difficulty) {
        try {
            Question.DifficultyLevel difficultyLevel = Question.DifficultyLevel.valueOf(difficulty.toUpperCase());
            return questionRepository.findByDifficultyAndIsDeletedFalseOrderByCreatedAtDesc(difficultyLevel)
                    .stream()
                    .map(QuestionDTO::fromEntity)
                    .collect(Collectors.toList());
        } catch (IllegalArgumentException e) {
            log.warn("无效的难度等级：{}", difficulty);
            return List.of();
        }
    }

    /**
     * 根据分类和难度查询题目
     */
    public List<QuestionDTO> getQuestionsByCategoryAndDifficulty(String category, String difficulty) {
        try {
            Question.DifficultyLevel difficultyLevel = Question.DifficultyLevel.valueOf(difficulty.toUpperCase());
            return questionRepository.findByCategoryAndDifficultyAndIsDeletedFalseOrderByCreatedAtDesc(category, difficultyLevel)
                    .stream()
                    .map(QuestionDTO::fromEntity)
                    .collect(Collectors.toList());
        } catch (IllegalArgumentException e) {
            log.warn("无效的难度等级：{}", difficulty);
            return getQuestionsByCategory(category);
        }
    }

    /**
     * 根据关键词搜索题目
     */
    public List<QuestionDTO> searchQuestions(String keyword) {
        return questionRepository.findByContentContainingAndIsDeletedFalse(keyword)
                .stream()
                .map(QuestionDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * 根据标签查询题目
     */
    public List<QuestionDTO> getQuestionsByTag(String tag) {
        return questionRepository.findByTagAndIsDeletedFalse(tag)
                .stream()
                .map(QuestionDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * 根据ID列表查询题目（用于试卷生成）
     */
    public List<QuestionDTO> getQuestionsByIds(List<Long> ids) {
        return questionRepository.findByIdInAndIsDeletedFalseOrderByCreatedAtDesc(ids)
                .stream()
                .map(QuestionDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * 更新题目
     */
    @Transactional
    public Optional<QuestionDTO> updateQuestion(Long id, CreateQuestionRequest request) {
        return questionRepository.findById(id)
                .filter(question -> !question.getIsDeleted())
                .map(question -> {
                    question.setContent(request.getContent());
                    question.setImageUrl(request.getImageUrl());
                    question.setCategory(request.getCategory());
                    
                    if (request.getDifficulty() != null) {
                        try {
                            question.setDifficulty(Question.DifficultyLevel.valueOf(request.getDifficulty().toUpperCase()));
                        } catch (IllegalArgumentException e) {
                            log.warn("无效的难度等级：{}，保持原有难度", request.getDifficulty());
                        }
                    }
                    
                    question.setTags(request.getTags());
                    question.setOcrConfidence(request.getOcrConfidence());
                    question.setAiConfidence(request.getAiConfidence());
                    
                    Question savedQuestion = questionRepository.save(question);
                    log.info("题目更新成功，ID：{}", savedQuestion.getId());
                    return QuestionDTO.fromEntity(savedQuestion);
                });
    }

    /**
     * 删除题目（逻辑删除）
     */
    @Transactional
    public boolean deleteQuestion(Long id) {
        return questionRepository.findById(id)
                .filter(question -> !question.getIsDeleted())
                .map(question -> {
                    question.setIsDeleted(true);
                    questionRepository.save(question);
                    log.info("题目删除成功，ID：{}", id);
                    return true;
                })
                .orElse(false);
    }

    /**
     * 获取分类统计
     */
    public Map<String, Long> getCategoryStatistics() {
        List<Object[]> results = questionRepository.countByCategory();
        return results.stream()
                .collect(Collectors.toMap(
                        result -> (String) result[0],
                        result -> (Long) result[1]
                ));
    }

    /**
     * 获取难度统计
     */
    public Map<String, Long> getDifficultyStatistics() {
        List<Object[]> results = questionRepository.countByDifficulty();
        return results.stream()
                .collect(Collectors.toMap(
                        result -> ((Question.DifficultyLevel) result[0]).name().toLowerCase(),
                        result -> (Long) result[1]
                ));
    }
} 