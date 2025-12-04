package com.mistake.notebook.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import okhttp3.*;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 基于 OkHttp 的 OpenAI 兼容客户端
 */
@Component
@RequiredArgsConstructor
public class SimpleOpenAIClient {

    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    private final AIConfig aiConfig;
    private final ObjectMapper objectMapper;

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(180, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build();

    /**
     * 调用兼容模式 chat completions
     */
    public Response createChatCompletion(Map<String, Object> requestData) throws IOException {
        String requestJson = objectMapper.writeValueAsString(requestData);
        RequestBody body = RequestBody.create(requestJson, JSON);

        Request request = new Request.Builder()
                .url(buildUrl("chat/completions"))
                .post(body)
                .addHeader("Authorization", "Bearer " + aiConfig.getApiKey())
                .addHeader("Content-Type", "application/json")
                .build();

        return httpClient.newCall(request).execute();
    }

    private String buildUrl(String path) {
        String base = aiConfig.getBaseUrl();
        if (base == null || base.isEmpty()) {
            base = "https://dashscope.aliyuncs.com/compatible-mode/v1/";
        }

        if (!base.endsWith("/")) {
            base = base + "/";
        }

        if (path.startsWith("/")) {
            path = path.substring(1);
        }

        return base + path;
    }
}

