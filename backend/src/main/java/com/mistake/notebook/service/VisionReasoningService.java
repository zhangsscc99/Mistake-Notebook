package com.mistake.notebook.service;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * 百炼视觉推理服务
 * 使用阿里云百炼平台的视觉推理模型替代传统OCR
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VisionReasoningService {

    @Value("${aliyun.dashscope.api-key}")
    private String apiKey;

    @Value("${aliyun.dashscope.base-url}")
    private String baseUrl;

    @Value("${aliyun.dashscope.vision.model}")
    private String visionModel;

    @Value("${aliyun.dashscope.vision.enable-thinking}")
    private boolean enableThinking;

    @Value("${aliyun.dashscope.vision.thinking-budget}")
    private int thinkingBudget;

    @Value("${aliyun.dashscope.vision.max-tokens}")
    private int maxTokens;

    @Value("${aliyun.dashscope.vision.temperature}")
    private double temperature;

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(120, TimeUnit.SECONDS)
            .readTimeout(300, TimeUnit.SECONDS)
            .writeTimeout(120, TimeUnit.SECONDS)
            .build();

    /**
     * 使用视觉推理模型识别图片中的文字
     */
    public VisionResult recognizeText(MultipartFile file) {
        try {
            // 验证文件
            if (file.isEmpty()) {
                return new VisionResult(false, "", "", 0.0, "文件为空");
            }

            // 验证文件大小（最大10MB）
            if (file.getSize() > 10 * 1024 * 1024) {
                return new VisionResult(false, "", "", 0.0, "文件大小超过限制");
            }

            // 验证文件类型
            String contentType = file.getContentType();
            if (contentType == null || !isImageFile(contentType)) {
                return new VisionResult(false, "", "", 0.0, "不支持的文件类型");
            }

            log.info("开始视觉推理识别，文件名：{}，大小：{} bytes", file.getOriginalFilename(), file.getSize());

            // 构建识别文字的提示词
            String prompt = "请仔细识别这张图片中的所有文字内容，包括题目、选项、公式等。" +
                    "要求：\n" +
                    "1. 准确识别所有文字，包括数学公式、符号\n" +
                    "2. 保持原有的格式和结构\n" +
                    "3. 如果有选择题选项，请保持A、B、C、D的格式\n" +
                    "4. 直接输出识别的文字内容，不要添加额外说明";

            return callVisionAPI(file, prompt, false);

        } catch (Exception e) {
            log.error("视觉推理识别失败", e);
            return new VisionResult(false, "", "", 0.0, "识别过程中发生错误：" + e.getMessage());
        }
    }

    /**
     * 使用视觉推理模型识别并分割题目
     */
    public VisionQuestionResult recognizeAndSegmentQuestions(MultipartFile file) {
        try {
            // 验证文件
            if (file.isEmpty()) {
                return new VisionQuestionResult(false, null, "", 0.0, "文件为空");
            }

            // 验证文件大小和类型
            if (file.getSize() > 10 * 1024 * 1024) {
                return new VisionQuestionResult(false, null, "", 0.0, "文件大小超过限制");
            }

            String contentType = file.getContentType();
            if (contentType == null || !isImageFile(contentType)) {
                return new VisionQuestionResult(false, null, "", 0.0, "不支持的文件类型");
            }

            log.info("开始视觉推理题目分割，文件名：{}，大小：{} bytes", file.getOriginalFilename(), file.getSize());

            // 构建题目分割的提示词
            String prompt = buildQuestionSegmentationPrompt();

            VisionResult result = callVisionAPI(file, prompt, true);
            
            if (!result.isSuccess()) {
                return new VisionQuestionResult(false, null, result.getReasoningContent(), 
                        result.getConfidence(), result.getError());
            }

            // 解析AI响应，提取题目信息
            List<VisionQuestion> questions = parseQuestionSegmentationResponse(result.getContent());
            
            log.info("视觉推理题目分割完成，识别到{}道题目", questions.size());
            return new VisionQuestionResult(true, questions, result.getReasoningContent(), 
                    result.getConfidence(), null);

        } catch (Exception e) {
            log.error("视觉推理题目分割失败", e);
            return new VisionQuestionResult(false, null, "", 0.0, "分割过程中发生错误：" + e.getMessage());
        }
    }

    /**
     * 调用百炼视觉推理API
     */
    private VisionResult callVisionAPI(MultipartFile file, String prompt, boolean useThinking) {
        try {
            // 检查API配置
            log.debug("检查API配置 - apiKey: {}, baseUrl: {}, model: {}", 
                    apiKey != null ? apiKey.substring(0, Math.min(10, apiKey.length())) + "..." : "null", 
                    baseUrl, visionModel);
            
            if (apiKey == null || apiKey.equals("not-configured")) {
                log.warn("百炼视觉推理API未配置，apiKey: {}", apiKey);
                return new VisionResult(false, "", "", 0.0, "API未配置，请设置DASHSCOPE_API_KEY环境变量");
            }

            // 将图片转换为base64
            byte[] imageBytes = file.getBytes();
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            String imageUrl = "data:" + file.getContentType() + ";base64," + base64Image;

            // 构建请求体
            JsonObject requestBody = new JsonObject();
            requestBody.addProperty("model", visionModel);

            JsonArray messages = new JsonArray();
            JsonObject message = new JsonObject();
            message.addProperty("role", "user");

            // 构建多模态内容
            JsonArray content = new JsonArray();
            
            // 添加图片
            JsonObject imageContent = new JsonObject();
            imageContent.addProperty("type", "image_url");
            JsonObject imageUrl_obj = new JsonObject();
            imageUrl_obj.addProperty("url", imageUrl);
            imageContent.add("image_url", imageUrl_obj);
            content.add(imageContent);

            // 添加文本提示
            JsonObject textContent = new JsonObject();
            textContent.addProperty("type", "text");
            textContent.addProperty("text", prompt);
            content.add(textContent);

            message.add("content", content);
            messages.add(message);
            requestBody.add("messages", messages);

            // 设置参数（直接添加到requestBody，不使用extra_body）
            requestBody.addProperty("temperature", temperature);
            requestBody.addProperty("max_tokens", maxTokens);
            requestBody.addProperty("stream", false);
            
            if (useThinking && enableThinking) {
                requestBody.addProperty("enable_thinking", true);
                requestBody.addProperty("thinking_budget", thinkingBudget);
            }

            // 构建HTTP请求
            RequestBody body = RequestBody.create(
                    requestBody.toString(),
                    MediaType.get("application/json; charset=utf-8")
            );

            String apiUrl = baseUrl.endsWith("/")
                    ? baseUrl + "chat/completions"
                    : baseUrl + "/chat/completions";

            Request request = new Request.Builder()
                    .url(apiUrl)
                    .post(body)
                    .addHeader("Authorization", "Bearer " + apiKey)
                    .addHeader("Content-Type", "application/json")
                    .build();

            log.debug("发送视觉推理请求到百炼平台...");
            long startTime = System.currentTimeMillis();

            try (Response response = httpClient.newCall(request).execute()) {
                long endTime = System.currentTimeMillis();
                log.info("收到视觉推理响应，耗时: {} 毫秒", (endTime - startTime));

                if (!response.isSuccessful()) {
                    log.error("视觉推理API调用失败，状态码：{}", response.code());
                    return new VisionResult(false, "", "", 0.0, "API调用失败，状态码：" + response.code());
                }

                String responseBody = response.body().string();
                log.debug("视觉推理响应内容：{}", responseBody);

                return parseVisionResponse(responseBody);
            }

        } catch (IOException e) {
            log.error("调用视觉推理API异常", e);
            return new VisionResult(false, "", "", 0.0, "API调用异常：" + e.getMessage());
        } catch (Exception e) {
            log.error("视觉推理处理异常", e);
            return new VisionResult(false, "", "", 0.0, "处理异常：" + e.getMessage());
        }
    }

    /**
     * 解析视觉推理API响应
     */
    private VisionResult parseVisionResponse(String responseBody) {
        try {
            JsonObject responseJson = new Gson().fromJson(responseBody, JsonObject.class);
            
            if (responseJson.has("choices")) {
                JsonArray choices = responseJson.getAsJsonArray("choices");
                if (choices.size() > 0) {
                    JsonObject firstChoice = choices.get(0).getAsJsonObject();
                    if (firstChoice.has("message")) {
                        JsonObject messageObj = firstChoice.getAsJsonObject("message");
                        
                        String content = "";
                        String reasoningContent = "";
                        
                        // 获取主要内容
                        if (messageObj.has("content")) {
                            content = messageObj.get("content").getAsString();
                        }
                        
                        // 获取推理过程（如果有）
                        if (messageObj.has("reasoning_content")) {
                            reasoningContent = messageObj.get("reasoning_content").getAsString();
                        }
                        
                        double confidence = 0.9; // 默认置信度
                        
                        if (content != null && !content.trim().isEmpty()) {
                            log.info("视觉推理成功，内容长度：{}，推理过程长度：{}", 
                                    content.length(), reasoningContent.length());
                            return new VisionResult(true, content.trim(), reasoningContent, confidence, null);
                        }
                    }
                }
            }
            
            log.warn("无法从视觉推理响应中提取内容");
            return new VisionResult(false, "", "", 0.0, "无法提取响应内容");
            
        } catch (Exception e) {
            log.error("解析视觉推理响应失败", e);
            return new VisionResult(false, "", "", 0.0, "响应解析失败：" + e.getMessage());
        }
    }

    /**
     * 构建题目分割提示词
     */
    private String buildQuestionSegmentationPrompt() {
        return """
                请仔细分析这张图片中的题目，并按照以下要求进行分割和识别：
                
                1. 识别图片中的所有题目，每道题目单独处理
                2. 对于每道题目，请提供：
                   - 题目序号（如果有）
                   - 完整的题目内容（包括题干和选项）
                   - 题目类型（选择题、填空题、解答题等）
                   - 学科分类（数学、语文、英语、物理、化学、计算机/编程等）
                   - 题目在原图片中的相对位置（top/left/width/height，以0-1之间的小数表示百分比）
                
                3. 输出格式要求：
                请严格按照以下JSON格式输出，不要添加任何额外说明：
                {
                  "questions": [
                    {
                      "id": 1,
                      "content": "题目完整内容",
                      "type": "题目类型",
                      "subject": "学科分类",
                      "confidence": 0.95,
                      "bounds": {
                        "top": 0.12,
                        "left": 0.05,
                        "width": 0.90,
                        "height": 0.18
                      }
                    }
                  ]
                }
                
                4. 注意事项：
                   - top/left 表示题目框左上角相对于整张图片的位置（0表示顶部/最左，1表示底部/最右）
                   - width/height 表示题目区域宽高相对于整张图片的比例
                   - 如果无法确定位置，请根据题目相对顺序估算百分比，但不可省略bounds字段
                   - 保持数学公式、符号的准确性
                   - 选择题要包含所有选项
                   - 如果图片模糊或无法识别，请在confidence中体现
                   - 每道题目的confidence应该在0.1-1.0之间
                """;
    }

    /**
     * 解析题目分割响应
     */
    private List<VisionQuestion> parseQuestionSegmentationResponse(String response) {
        List<VisionQuestion> questions = new ArrayList<>();
        
        try {
            // 尝试从响应中提取JSON部分
            String jsonPart = extractJsonFromResponse(response);
            if (jsonPart == null) {
                log.warn("无法从响应中提取JSON格式的题目信息");
                return questions;
            }
            
            JsonObject jsonResponse = new Gson().fromJson(jsonPart, JsonObject.class);
            
            if (jsonResponse.has("questions")) {
                JsonArray questionsArray = jsonResponse.getAsJsonArray("questions");
                
                for (int i = 0; i < questionsArray.size(); i++) {
                    JsonObject questionObj = questionsArray.get(i).getAsJsonObject();
                    
                    int id = questionObj.has("id") ? questionObj.get("id").getAsInt() : i + 1;
                    String content = questionObj.has("content") ? questionObj.get("content").getAsString() : "";
                    String type = questionObj.has("type") ? questionObj.get("type").getAsString() : "未知";
                    String subject = questionObj.has("subject") ? questionObj.get("subject").getAsString() : "未分类";
                    double confidence = questionObj.has("confidence") ? questionObj.get("confidence").getAsDouble() : 0.8;
                    
                    VisionQuestionBounds bounds = null;
                    if (questionObj.has("bounds") && questionObj.get("bounds").isJsonObject()) {
                        JsonObject boundsObj = questionObj.getAsJsonObject("bounds");
                        double top = boundsObj.has("top") ? boundsObj.get("top").getAsDouble() : (double) i / Math.max(1, questionsArray.size());
                        double left = boundsObj.has("left") ? boundsObj.get("left").getAsDouble() : 0.0;
                        double width = boundsObj.has("width") ? boundsObj.get("width").getAsDouble() : 1.0;
                        double height = boundsObj.has("height") ? boundsObj.get("height").getAsDouble() : (1.0 / Math.max(1, questionsArray.size()));
                        bounds = new VisionQuestionBounds(top, left, width, height);
                    }
                    
                    if (!content.trim().isEmpty()) {
                        questions.add(new VisionQuestion(id, content.trim(), type, subject, confidence, bounds));
                    }
                }
            }
            
        } catch (Exception e) {
            log.error("解析题目分割响应失败", e);
        }
        
        return questions;
    }

    /**
     * 从响应中提取JSON部分
     */
    private String extractJsonFromResponse(String response) {
        if (response == null || response.trim().isEmpty()) {
            return null;
        }
        
        // 查找JSON开始和结束位置
        int jsonStart = response.indexOf("{");
        int jsonEnd = response.lastIndexOf("}");
        
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
            return response.substring(jsonStart, jsonEnd + 1);
        }
        
        return null;
    }

    /**
     * 验证是否为图片文件
     */
    private boolean isImageFile(String contentType) {
        return contentType.startsWith("image/") &&
                (contentType.contains("jpeg") ||
                        contentType.contains("jpg") ||
                        contentType.contains("png") ||
                        contentType.contains("gif") ||
                        contentType.contains("bmp") ||
                        contentType.contains("webp"));
    }

    /**
     * 视觉推理结果
     */
    public static class VisionResult {
        private final boolean success;
        private final String content;
        private final String reasoningContent;
        private final double confidence;
        private final String error;

        public VisionResult(boolean success, String content, String reasoningContent, double confidence, String error) {
            this.success = success;
            this.content = content;
            this.reasoningContent = reasoningContent;
            this.confidence = confidence;
            this.error = error;
        }

        public boolean isSuccess() { return success; }
        public String getContent() { return content; }
        public String getReasoningContent() { return reasoningContent; }
        public double getConfidence() { return confidence; }
        public String getError() { return error; }
    }

    /**
     * 视觉推理题目分割结果
     */
    public static class VisionQuestionResult {
        private final boolean success;
        private final List<VisionQuestion> questions;
        private final String reasoningContent;
        private final double overallConfidence;
        private final String error;

        public VisionQuestionResult(boolean success, List<VisionQuestion> questions, String reasoningContent, 
                                   double overallConfidence, String error) {
            this.success = success;
            this.questions = questions;
            this.reasoningContent = reasoningContent;
            this.overallConfidence = overallConfidence;
            this.error = error;
        }

        public boolean isSuccess() { return success; }
        public List<VisionQuestion> getQuestions() { return questions; }
        public String getReasoningContent() { return reasoningContent; }
        public double getOverallConfidence() { return overallConfidence; }
        public String getError() { return error; }
    }

    /**
     * 视觉推理识别的题目信息
     */
    public static class VisionQuestion {
        private final int id;
        private final String content;
        private final String type;
        private final String subject;
        private final double confidence;
        private final VisionQuestionBounds bounds;

        public VisionQuestion(int id, String content, String type, String subject, double confidence, VisionQuestionBounds bounds) {
            this.id = id;
            this.content = content;
            this.type = type;
            this.subject = subject;
            this.confidence = confidence;
            this.bounds = bounds;
        }

        public int getId() { return id; }
        public String getContent() { return content; }
        public String getType() { return type; }
        public String getSubject() { return subject; }
        public double getConfidence() { return confidence; }
        public VisionQuestionBounds getBounds() { return bounds; }
    }

    /**
     * 视觉题目的位置信息
     */
    public static class VisionQuestionBounds {
        private final double top;
        private final double left;
        private final double width;
        private final double height;

        public VisionQuestionBounds(double top, double left, double width, double height) {
            this.top = top;
            this.left = left;
            this.width = width;
            this.height = height;
        }

        public double getTop() { return top; }
        public double getLeft() { return left; }
        public double getWidth() { return width; }
        public double getHeight() { return height; }
    }
}
