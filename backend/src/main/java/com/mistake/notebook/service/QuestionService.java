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
    private final AIAnswerService aiAnswerService;

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
        dto.setAiAnswer(request.getAiAnswer());
        dto.setAiAnalysis(request.getAiAnalysis());
        
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
                    question.setAiAnswer(request.getAiAnswer());
                    question.setAiAnalysis(request.getAiAnalysis());
                    
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
     * 批量删除题目
     */
    @Transactional
    public void batchDeleteQuestions(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        questionRepository.findAllById(ids).forEach(question -> {
            if (!question.getIsDeleted()) {
                question.setIsDeleted(true);
                questionRepository.save(question);
                log.info("批量删除题目，ID：{}", question.getId());
            }
        });
    }

    /**
     * 根据分类ID获取题目列表
     */
    public List<QuestionDTO> getQuestionsByCategory(Long categoryId) {
        log.info("根据分类ID {} 查询题目列表", categoryId);
        
        List<Question> questions = questionRepository.findByCategoryIdAndIsDeletedFalseOrderByCreatedAtDesc(categoryId);
        
        List<QuestionDTO> questionDTOs = questions.stream()
                .map(QuestionDTO::fromEntity)
                .collect(Collectors.toList());
        
        log.info("分类ID {} 下共找到 {} 道题目", categoryId, questionDTOs.size());
        return questionDTOs;
    }

    /**
     * 重新生成 AI 答案与解析
     */
    @Transactional
    public Optional<QuestionDTO> regenerateAiAnswer(Long id) {
        return questionRepository.findById(id)
                .filter(q -> !q.getIsDeleted())
                .map(question -> {
                    AIAnswerService.AnswerResult result = aiAnswerService.generateAnswer(question.getContent());
                    question.setAiAnswer(result.getAnswer());
                    question.setAiAnalysis(result.getAnalysis());
                    if (result.isSuccess()) {
                        question.setAiConfidence(result.getConfidence());
                    }
                    Question saved = questionRepository.save(question);
                    log.info("题目 {} AI 解析已重新生成", id);
                    return QuestionDTO.fromEntity(saved);
                });
    }

    /**
     * 创建处于"待AI解析"状态的题目（快速返回，后台异步生成答案/分类）
     */
    @Transactional
    public QuestionDTO createPendingQuestion(CreateQuestionRequest request) {
        QuestionDTO dto = new QuestionDTO();
        dto.setContent(request.getContent());
        dto.setImageUrl(request.getImageUrl());
        dto.setCategory(request.getCategory());
        dto.setDifficulty(request.getDifficulty());
        dto.setTags(request.getTags());
        dto.setOcrConfidence(request.getOcrConfidence());
        dto.setAiStatus("pending");

        Question question = dto.toEntity();
        question.setAiStatus(Question.AiStatus.PENDING);
        Question saved = questionRepository.save(question);
        log.info("题目已保存(待解析)，ID：{}", saved.getId());
        return QuestionDTO.fromEntity(saved);
    }

    /**
     * 查询正在/等待 AI 解析（或失败）的题目，用于"解析中"轮询
     */
    public List<QuestionDTO> getPendingQuestions() {
        List<Question.AiStatus> statuses = List.of(
                Question.AiStatus.PENDING,
                Question.AiStatus.PROCESSING,
                Question.AiStatus.FAILED);
        return questionRepository.findByAiStatusInAndIsDeletedFalseOrderByCreatedAtDesc(statuses)
                .stream()
                .map(QuestionDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * 标记题目进入 AI 处理中（独立事务，便于前端立即看到状态）
     */
    @Transactional
    public void markAiProcessing(Long id) {
        questionRepository.findById(id).ifPresent(q -> {
            q.setAiStatus(Question.AiStatus.PROCESSING);
            questionRepository.save(q);
        });
    }

    /**
     * 将题目重置为待解析（用于重试）
     */
    @Transactional
    public boolean markAiPending(Long id) {
        return questionRepository.findById(id)
                .filter(q -> !q.getIsDeleted())
                .map(q -> {
                    q.setAiStatus(Question.AiStatus.PENDING);
                    q.setAiError(null);
                    questionRepository.save(q);
                    return true;
                })
                .orElse(false);
    }

    /**
     * 写入 AI 分类与答案结果，并把状态置为完成/失败
     */
    @Transactional
    public void applyAiResult(Long id,
                              AIClassificationService.ClassificationResult classification,
                              AIAnswerService.AnswerResult answer) {
        questionRepository.findById(id).ifPresent(q -> {
            if (classification != null && classification.isSuccess()) {
                if (classification.getCategory() != null) {
                    q.setCategory(classification.getCategory());
                    q.setCategoryId(QuestionDTO.mapCategoryToId(classification.getCategory()));
                }
                if (classification.getDifficulty() != null) {
                    q.setDifficulty(classification.getDifficulty());
                }
                if (classification.getTags() != null && !classification.getTags().isEmpty()) {
                    q.setTags(classification.getTags());
                }
                q.setAiConfidence(classification.getConfidence());
            }

            boolean success = answer != null && answer.isSuccess();
            if (answer != null) {
                q.setAiAnswer(answer.getAnswer());
                q.setAiAnalysis(answer.getAnalysis());
            }

            if (success) {
                q.setAiStatus(Question.AiStatus.COMPLETED);
                q.setAiError(null);
            } else {
                q.setAiStatus(Question.AiStatus.FAILED);
                q.setAiError(answer != null ? answer.getAnalysis() : "AI解析失败");
            }
            questionRepository.save(q);
            log.info("题目 {} AI解析完成，状态：{}", id, q.getAiStatus());
        });
    }

    /**
     * 标记题目 AI 解析失败
     */
    @Transactional
    public void markAiFailed(Long id, String error) {
        questionRepository.findById(id).ifPresent(q -> {
            q.setAiStatus(Question.AiStatus.FAILED);
            q.setAiError(error);
            questionRepository.save(q);
        });
    }

    /**
     * 读取题目内容（供异步任务使用）
     */
    public Optional<String> getQuestionContent(Long id) {
        return questionRepository.findById(id)
                .filter(q -> !q.getIsDeleted())
                .map(Question::getContent);
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