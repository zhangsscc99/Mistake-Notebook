package com.mistake.notebook.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * 创建题目请求DTO
 */
@Data
public class CreateQuestionRequest {

    @NotBlank(message = "题目内容不能为空")
    private String content;

    private String imageUrl;

    @NotBlank(message = "题目分类不能为空")
    private String category;

    private String difficulty = "medium"; // 默认中等难度

    private List<String> tags;

    private Double ocrConfidence;

    private Double aiConfidence;

    private String aiAnswer;

    private String aiAnalysis;
} 