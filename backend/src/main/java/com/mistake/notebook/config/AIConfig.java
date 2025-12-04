package com.mistake.notebook.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 通义千问（DashScope）AI配置
 */
@Data
@Component
@ConfigurationProperties(prefix = "ai.aliyun")
public class AIConfig {

    /**
     * API Key
     */
    private String apiKey;

    /**
     * 兼容 OpenAI 的 Base URL，例如 https://dashscope.aliyuncs.com/compatible-mode/v1/
     */
    private String baseUrl;

    /**
     * 默认使用的模型
     */
    private String model;

    /**
     * 智能体应用 ID（可选）
     */
    private String applicationId;

    /**
     * 系统提示词（通用场景）
     */
    private String systemContent;

    /**
     * 支付/其它专用模型（可选）
     */
    private String paymentModel;

    /**
     * 支付场景系统提示词
     */
    private String paymentSystemContent;
}

