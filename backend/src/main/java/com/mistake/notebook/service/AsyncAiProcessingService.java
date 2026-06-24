package com.mistake.notebook.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * AI 后台异步处理：题目分类 + 答案解析。
 * 上传保存接口先把题目落库为 PENDING 并立即返回，由本服务在线程池中完成耗时的 AI 调用，
 * 完成后更新题目状态，前端通过轮询 /questions/pending 感知进度。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AsyncAiProcessingService {

    private final QuestionService questionService;
    private final AIClassificationService aiClassificationService;
    private final AIAnswerService aiAnswerService;

    /**
     * 异步处理单道题目的 AI 分类与解析
     */
    @Async("aiTaskExecutor")
    public void processQuestion(Long questionId) {
        if (questionId == null) {
            return;
        }
        String content = questionService.getQuestionContent(questionId).orElse(null);
        if (content == null || content.trim().isEmpty()) {
            questionService.markAiFailed(questionId, "题目内容为空");
            return;
        }

        try {
            questionService.markAiProcessing(questionId);

            AIClassificationService.ClassificationResult classification = null;
            try {
                classification = aiClassificationService.classifyQuestion(content);
            } catch (Exception e) {
                log.error("题目 {} AI分类异常", questionId, e);
            }

            AIAnswerService.AnswerResult answer;
            try {
                answer = aiAnswerService.generateAnswer(content);
            } catch (Exception e) {
                log.error("题目 {} AI答案生成异常", questionId, e);
                answer = AIAnswerService.AnswerResult.empty("AI答案生成异常：" + e.getMessage());
            }

            questionService.applyAiResult(questionId, classification, answer);
        } catch (Exception e) {
            log.error("题目 {} 异步AI处理失败", questionId, e);
            questionService.markAiFailed(questionId, e.getMessage());
        }
    }
}
