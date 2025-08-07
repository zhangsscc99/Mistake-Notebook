package com.mistake.notebook.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.aliyun.ocr_api20210707.Client;
import com.aliyun.ocr_api20210707.models.RecognizeAllTextRequest;
import com.aliyun.ocr_api20210707.models.RecognizeAllTextResponse;
import com.aliyun.teaopenapi.models.Config;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;

import okhttp3.*;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.TimeUnit;

/**
 * OCR图像识别服务
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OCRService {

    @Value("${aliyun.access-key-id}")
    private String accessKeyId;

    @Value("${aliyun.access-key-secret}")
    private String accessKeySecret;

    @Value("${aliyun.ocr.endpoint}")
    private String endpoint;

    @Value("${aliyun.dashscope.api-key}")
    private String dashscopeApiKey;

    @Value("${aliyun.dashscope.base-url}")
    private String dashscopeBaseUrl;

    @Value("${aliyun.dashscope.model}")
    private String dashscopeModel;

    private final Random random = new Random();
    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(180, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build();

    /**
     * 识别图片中的文字
     */
    public OCRResult recognizeText(MultipartFile file) {
        try {
            // 验证文件
            if (file.isEmpty()) {
                return new OCRResult(false, "", 0.0, "文件为空");
            }

            // 验证文件大小（最大10MB）
            if (file.getSize() > 10 * 1024 * 1024) {
                return new OCRResult(false, "", 0.0, "文件大小超过限制");
            }

            // 验证文件类型
            String contentType = file.getContentType();
            if (contentType == null || !isImageFile(contentType)) {
                return new OCRResult(false, "", 0.0, "不支持的文件类型");
            }

            log.info("开始OCR识别，文件名：{}，大小：{} bytes", file.getOriginalFilename(), file.getSize());

            // 调用真实的阿里云OCR API
            return performRealOCR(file);

            /*
            // 真实的阿里云OCR API调用代码（需要配置阿里云凭证）
            DefaultProfile profile = DefaultProfile.getProfile("cn-hangzhou", accessKeyId, accessKeySecret);
            IAcsClient client = new DefaultAcsClient(profile);
            
            RecognizeGeneralRequest request = new RecognizeGeneralRequest();
            request.setSysEndpoint(endpoint);
            request.setImageType(1); // 1表示传入图片为base64编码
            
            // 将图片转换为base64
            byte[] imageBytes = file.getBytes();
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            request.setImageData(base64Image);
            
            RecognizeGeneralResponse response = client.getAcsResponse(request);
            
            if (response.getData() != null && response.getData().getContent() != null) {
                String recognizedText = response.getData().getContent();
                double confidence = response.getData().getConfidence() != null ? 
                    response.getData().getConfidence() : 0.9;
                
                log.info("OCR识别成功，识别文字长度：{}", recognizedText.length());
                return new OCRResult(true, recognizedText, confidence, null);
            } else {
                return new OCRResult(false, "", 0.0, "OCR识别失败");
            }
            */

        } catch (Exception e) {
            log.error("OCR识别失败", e);
            return new OCRResult(false, "", 0.0, "识别过程中发生错误：" + e.getMessage());
        }
    }

    /**
     * 识别图片中的多个题目并分割
     */
    public QuestionSegmentResult recognizeAndSegmentQuestions(MultipartFile file) {
        try {
            // 验证文件
            if (file.isEmpty()) {
                return new QuestionSegmentResult(false, null, "文件为空");
            }

            // 验证文件大小和类型
            if (file.getSize() > 10 * 1024 * 1024) {
                return new QuestionSegmentResult(false, null, "文件大小超过限制");
            }

            String contentType = file.getContentType();
            if (contentType == null || !isImageFile(contentType)) {
                return new QuestionSegmentResult(false, null, "不支持的文件类型");
            }

            log.info("开始题目分割OCR识别，文件名：{}，大小：{} bytes", file.getOriginalFilename(), file.getSize());

            // 调用真实的题目分割API
            return performRealQuestionSegmentation(file);

        } catch (Exception e) {
            log.error("题目分割OCR识别失败", e);
            return new QuestionSegmentResult(false, null, "识别过程中发生错误：" + e.getMessage());
        }
    }

    /**
     * 真实的题目分割识别
     */
    private QuestionSegmentResult performRealQuestionSegmentation(MultipartFile file) {
        try {
            // 首先进行OCR文字识别
            OCRResult ocrResult = performRealOCR(file);
            if (!ocrResult.isSuccess() || ocrResult.getText().trim().isEmpty()) {
                return new QuestionSegmentResult(false, null, "OCR识别失败：" + ocrResult.getError());
            }

            // 基于真实OCR结果进行智能题目分割
            List<QuestionSegment> questions = segmentQuestionsIntelligently(ocrResult.getText());

        double overallConfidence = questions.stream()
            .mapToDouble(QuestionSegment::getConfidence)
            .average()
                .orElse(ocrResult.getConfidence());

            log.info("题目分割完成，识别到{}道题目，总体置信度：{}", questions.size(), overallConfidence);
        return new QuestionSegmentResult(true, questions, null, overallConfidence);
            
        } catch (Exception e) {
            log.error("题目分割处理失败", e);
            return new QuestionSegmentResult(false, null, "题目分割失败：" + e.getMessage());
        }
    }


    
    /**
     * 智能题目分割算法：基于多种特征识别和分割题目
     */
    private List<QuestionSegment> segmentQuestionsIntelligently(String fullText) {
        List<QuestionSegment> segments = new ArrayList<>();
        
        log.info("开始分割题目，完整文本长度：{}", fullText.length());
        log.debug("完整文本内容：{}", fullText);
        
                // 优先使用AI服务进行智能题目分割
        List<QuestionInfo> questionInfos = segmentQuestionsWithAI(fullText);
        
        // 如果AI分割失败，回退到传统方法
        if (questionInfos.isEmpty()) {
            log.warn("AI题目分割失败，使用传统方法");
            questionInfos = findQuestionNumbersInText(fullText);
            
            // 如果还没有找到，再按行分割处理
            if (questionInfos.isEmpty()) {
                String[] lines = fullText.split("\n");
                log.debug("文本共{}行", lines.length);
                
                for (int i = 0; i < lines.length; i++) {
                    String line = lines[i].trim();
                    log.debug("第{}行: '{}'", i, line);
                    QuestionInfo questionInfo = detectQuestionStart(line, i);
                    if (questionInfo != null) {
                        log.info("检测到题目开始：第{}行，题号{}，类型{}", i, questionInfo.questionNumber, questionInfo.type);
                        questionInfos.add(questionInfo);
                    }
                }
            }
            
            // 如果还没有找到明确的题目标号，尝试基于内容分割
            if (questionInfos.isEmpty()) {
                String[] lines = fullText.split("\n");
                questionInfos = fallbackContentBasedSegmentation(lines);
            }
        }
        
        // 重新分割文本为行数组，用于生成分割段
        String[] lines = fullText.split("\n");
        
        // 为每个题目生成分割段
        for (int i = 0; i < questionInfos.size(); i++) {
            QuestionInfo current = questionInfos.get(i);
            int startLine = current.startLine;
            int endLine = (i + 1 < questionInfos.size()) ? 
                         questionInfos.get(i + 1).startLine - 1 : lines.length - 1;
            
            // 组合题目完整内容
            String content = extractQuestionContent(lines, startLine, endLine);
            
            // 智能计算题目边界
            QuestionBounds bounds = calculateIntelligentBounds(current, lines, startLine, endLine);
            
            // 计算置信度和难度
            double confidence = calculateConfidenceByComplexity(content);
            boolean isDifficult = assessQuestionDifficulty(content);
            
            segments.add(new QuestionSegment(
                current.questionNumber, 
                content, 
                bounds, 
                confidence, 
                isDifficult
            ));
        }
        
        return segments;
    }
    
    /**
     * 使用AI服务进行智能题目分割
     */
    private List<QuestionInfo> segmentQuestionsWithAI(String fullText) {
        List<QuestionInfo> questionInfos = new ArrayList<>();
        
        try {
            // 检查AI配置
            if (dashscopeApiKey == null || dashscopeApiKey.equals("not-configured")) {
                log.warn("通义千问API未配置，跳过AI分割");
                return questionInfos;
            }
            
            log.info("开始使用AI服务分割题目");
            
            // 构建AI提示词
            String prompt = buildQuestionSegmentationPrompt(fullText);
            
            // 调用通义千问API
            String aiResponse = callDashScopeAPI(prompt);
            
            if (aiResponse != null && !aiResponse.trim().isEmpty()) {
                // 解析AI响应
                questionInfos = parseAISegmentationResponse(aiResponse, fullText);
                log.info("AI分割完成，识别到{}道题目", questionInfos.size());
            } else {
                log.warn("AI响应为空");
            }
            
        } catch (Exception e) {
            log.error("AI题目分割异常", e);
        }
        
        return questionInfos;
    }
    
    /**
     * 构建题目分割提示词
     */
    private String buildQuestionSegmentationPrompt(String ocrText) {
        return String.format("""
            请分析以下OCR识别的文本，识别并分割出其中的题目。
            
            要求：
            1. 识别文本中所有的题目（通常以数字+点号开始，如"20."、"21."）
            2. 每道题目可能包含多个小题（如"(1)"、"(2)"、"(3)"）
            3. 返回JSON格式，包含每道题目的题号和在文本中的大致位置
            4. 如果无法准确确定位置，请根据题目在文本中的顺序估算
            
            返回格式：
            {
              "questions": [
                {
                  "questionNumber": 20,
                  "startPosition": 0,
                  "content": "题目内容摘要"
                },
                {
                  "questionNumber": 21,
                  "startPosition": 300,
                  "content": "题目内容摘要"
                }
              ]
            }
            
            OCR文本：
            %s
            """, ocrText);
    }
    
    /**
     * 调用通义千问API
     */
    private String callDashScopeAPI(String prompt) {
        try {
            // 构建请求体
            JsonObject requestBody = new JsonObject();
            requestBody.addProperty("model", dashscopeModel);
            
            JsonArray messages = new JsonArray();
            JsonObject message = new JsonObject();
            message.addProperty("role", "user");
            message.addProperty("content", prompt);
            messages.add(message);
            requestBody.add("messages", messages);
            
            JsonObject parameters = new JsonObject();
            parameters.addProperty("temperature", 0.1); // 较低的温度以获得更准确的结果
            parameters.addProperty("max_tokens", 2000);
            requestBody.add("parameters", parameters);
            
            // 构建HTTP请求
            RequestBody body = RequestBody.create(
                requestBody.toString(), 
                MediaType.get("application/json; charset=utf-8")
            );
            
            Request request = new Request.Builder()
                    .url(dashscopeBaseUrl + "chat/completions")
                    .post(body)
                    .addHeader("Authorization", "Bearer " + dashscopeApiKey)
                    .addHeader("Content-Type", "application/json")
                    .build();
            
            log.debug("发送AI请求到通义千问...");
            long startTime = System.currentTimeMillis();
            
            try (Response response = httpClient.newCall(request).execute()) {
                long endTime = System.currentTimeMillis();
                log.info("收到AI响应，耗时: {} 毫秒", (endTime - startTime));
                
                if (!response.isSuccessful()) {
                    log.error("AI API调用失败，状态码：{}", response.code());
                    return null;
                }
                
                String responseBody = response.body().string();
                log.debug("AI响应内容：{}", responseBody);
                
                // 解析响应获取内容
                JsonObject responseJson = new Gson().fromJson(responseBody, JsonObject.class);
                if (responseJson.has("choices")) {
                    JsonArray choices = responseJson.getAsJsonArray("choices");
                    if (choices.size() > 0) {
                        JsonObject firstChoice = choices.get(0).getAsJsonObject();
                        if (firstChoice.has("message")) {
                            JsonObject messageObj = firstChoice.getAsJsonObject("message");
                            if (messageObj.has("content")) {
                                return messageObj.get("content").getAsString();
                            }
                        }
                    }
                }
                
                log.warn("无法从AI响应中提取内容");
                return null;
            }
            
        } catch (IOException e) {
            log.error("调用通义千问API异常", e);
            return null;
        }
    }
    
    /**
     * 解析AI分割响应
     */
    private List<QuestionInfo> parseAISegmentationResponse(String aiResponse, String fullText) {
        List<QuestionInfo> questionInfos = new ArrayList<>();
        
        try {
            // 提取JSON部分（AI可能返回额外的说明文字）
            String jsonPart = aiResponse;
            int jsonStart = aiResponse.indexOf("{");
            int jsonEnd = aiResponse.lastIndexOf("}") + 1;
            
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
                jsonPart = aiResponse.substring(jsonStart, jsonEnd);
            }
            
            log.debug("解析AI响应JSON：{}", jsonPart);
            
            JsonObject responseJson = new Gson().fromJson(jsonPart, JsonObject.class);
            if (responseJson.has("questions")) {
                JsonArray questions = responseJson.getAsJsonArray("questions");
                
                for (JsonElement questionElement : questions) {
                    JsonObject questionObj = questionElement.getAsJsonObject();
                    
                    if (questionObj.has("questionNumber")) {
                        int questionNumber = questionObj.get("questionNumber").getAsInt();
                        int startPosition = questionObj.has("startPosition") ? 
                            questionObj.get("startPosition").getAsInt() : 0;
                        
                        // 根据位置估算行号
                        String beforeText = fullText.substring(0, Math.min(startPosition, fullText.length()));
                        int lineIndex = beforeText.split("\n").length - 1;
                        
                        questionInfos.add(new QuestionInfo(questionNumber, lineIndex, "ai_segmentation"));
                        log.info("AI识别到题目{}，位置{}，估算行号{}", questionNumber, startPosition, lineIndex);
                    }
                }
            }
            
        } catch (Exception e) {
            log.error("解析AI分割响应失败", e);
        }
        
        return questionInfos;
    }
    
    /**
     * 直接在文本中查找题目标号
     */
    private List<QuestionInfo> findQuestionNumbersInText(String fullText) {
        List<QuestionInfo> questionInfos = new ArrayList<>();
        
        // 查找形如 "20." "21." 等题目标号
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("(\\d+)\\. 第\\d+小题");
        java.util.regex.Matcher matcher = pattern.matcher(fullText);
        
        int position = 0;
        while (matcher.find()) {
            int questionNum = Integer.parseInt(matcher.group(1));
            int startPos = matcher.start();
            
            // 计算这是第几行（粗略估算）
            String beforeText = fullText.substring(0, startPos);
            int lineIndex = beforeText.split("\n").length - 1;
            
            log.info("在文本位置{}找到题目{}，估算行号{}", startPos, questionNum, lineIndex);
            questionInfos.add(new QuestionInfo(questionNum, lineIndex, "text_search"));
        }
        
        // 如果没找到，尝试更宽松的匹配
        if (questionInfos.isEmpty()) {
            pattern = java.util.regex.Pattern.compile("(\\d{1,2})\\.");
            matcher = pattern.matcher(fullText);
            
            while (matcher.find()) {
                int questionNum = Integer.parseInt(matcher.group(1));
                // 只匹配合理的题目号（1-100）
                if (questionNum >= 1 && questionNum <= 100) {
                    int startPos = matcher.start();
                    String beforeText = fullText.substring(0, startPos);
                    int lineIndex = beforeText.split("\n").length - 1;
                    
                    // 检查是否是题目开始（后面有一些文字）
                    int endPos = Math.min(startPos + 20, fullText.length());
                    String context = fullText.substring(startPos, endPos);
                    
                    if (context.length() > 5) { // 确保后面有内容
                        log.info("宽松匹配：在位置{}找到可能的题目{}，上下文：{}", startPos, questionNum, context);
                        questionInfos.add(new QuestionInfo(questionNum, lineIndex, "loose_search"));
                    }
                }
            }
        }
        
        log.info("文本搜索找到{}道题目", questionInfos.size());
        return questionInfos;
    }
    
    /**
     * 检测题目开始位置的多种模式
     */
    private QuestionInfo detectQuestionStart(String line, int lineIndex) {
        log.debug("检测题目开始，行{}：'{}'", lineIndex, line);
        
        // 模式1: 数字 + 点号开头 (如 "20.", "21.")
        if (line.matches("^\\d+\\..*")) {
            String questionNum = line.replaceAll("^(\\d+)\\..*", "$1");
            log.debug("匹配到数字+点号模式，题号：{}", questionNum);
            return new QuestionInfo(Integer.parseInt(questionNum), lineIndex, "numbered");
        }
        
        // 模式1.5: 行中间包含题目标号 (如 "某些文字 20. 题目内容")
        if (line.matches(".*\\s+(\\d+)\\.\\s*第\\d+小题.*")) {
            String questionNum = line.replaceAll(".*\\s+(\\d+)\\.\\s*第\\d+小题.*", "$1");
            log.debug("匹配到行中题目标号模式，题号：{}", questionNum);
            return new QuestionInfo(Integer.parseInt(questionNum), lineIndex, "numbered");
        }
        
        // 模式2: 括号数字 (如 "(1)", "(2)")
        if (line.matches("^\\(\\d+\\).*")) {
            String questionNum = line.replaceAll("^\\((\\d+)\\).*", "$1");
            return new QuestionInfo(Integer.parseInt(questionNum), lineIndex, "parentheses");
        }
        
        // 模式3: 题目关键词开头 (如 "第1题", "题目1")
        if (line.matches("^(第\\d+题|题目\\d+|第\\d+小题).*")) {
            String questionNum = line.replaceAll("^(?:第|题目)(\\d+)(?:题|小题).*", "$1");
            try {
                return new QuestionInfo(Integer.parseInt(questionNum), lineIndex, "keyword");
            } catch (NumberFormatException e) {
                return null;
            }
        }
        
        // 模式4: 选择题标识 (如 "A.", "B.", "C.", "D." 前面的题目)
        if (line.matches(".*[ABCD]\\..*") && line.length() < 100) {
            // 这可能是选择题的选项，需要向前查找题目主体
            return null; // 暂时不处理，避免误识别
        }
        
        return null;
    }
    
    /**
     * 基于内容的备用分割方法
     */
    private List<QuestionInfo> fallbackContentBasedSegmentation(String[] lines) {
        List<QuestionInfo> questionInfos = new ArrayList<>();
        int questionCounter = 1;
        
        // 寻找内容较长的行作为题目开始
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            
            // 跳过空行和过短的行
            if (line.length() < 10) continue;
            
            // 检查是否可能是新题目的开始
            if (isPotentialQuestionStart(line, i, lines)) {
                questionInfos.add(new QuestionInfo(questionCounter++, i, "content_based"));
            }
        }
        
        return questionInfos;
    }
    
    /**
     * 判断是否是潜在的题目开始
     */
    private boolean isPotentialQuestionStart(String line, int lineIndex, String[] lines) {
        // 检查行长度：题目通常比较长
        if (line.length() < 20) return false;
        
        // 检查前一行：题目前通常有空行或分隔
        if (lineIndex > 0) {
            String prevLine = lines[lineIndex - 1].trim();
            if (!prevLine.isEmpty() && prevLine.length() > 30) {
                return false; // 前一行也是长内容，可能是同一题目的延续
            }
        }
        
        // 检查后续行：题目后面通常有子题或选项
        boolean hasFollowingContent = false;
        for (int i = lineIndex + 1; i < Math.min(lineIndex + 5, lines.length); i++) {
            String nextLine = lines[i].trim();
            if (nextLine.matches("^\\([1-3]\\).*") || nextLine.matches("^[ABCD]\\..*")) {
                hasFollowingContent = true;
                break;
            }
        }
        
        return hasFollowingContent || line.contains("分") || line.contains("题");
    }
    
    /**
     * 提取题目内容
     */
    private String extractQuestionContent(String[] lines, int startLine, int endLine) {
        StringBuilder content = new StringBuilder();
        
        for (int i = startLine; i <= endLine && i < lines.length; i++) {
            String line = lines[i].trim();
            if (!line.isEmpty()) {
                if (content.length() > 0) {
                    content.append(" ");
                }
                content.append(line);
            }
        }
        
        String result = content.toString();
        if (result.length() > 200) {
            result = result.substring(0, 197) + "...";
        }
        
        return result;
    }
    
    /**
     * 智能计算题目边界
     */
    private QuestionBounds calculateIntelligentBounds(QuestionInfo questionInfo, 
                                                     String[] lines, int startLine, int endLine) {
        // 基础位置计算
        double baseTop = calculateAdaptivePosition(startLine, lines.length);
        double baseHeight = calculateAdaptiveHeight(questionInfo, lines, startLine, endLine);
        
        // 根据题目类型调整边界
        double adjustedTop = baseTop;
        double adjustedHeight = baseHeight;
        double adjustedLeft = 5.0; // 默认左边距
        double adjustedWidth = 90.0; // 默认宽度
        
        // 根据题目类型进行微调
        switch (questionInfo.type) {
            case "numbered":
                // 大题通常占用更多空间
                adjustedHeight = Math.max(baseHeight, 15.0);
                break;
            case "parentheses":
                // 子题通常较小
                adjustedHeight = Math.max(baseHeight, 8.0);
                adjustedLeft = 8.0; // 稍微缩进
                adjustedWidth = 87.0;
                break;
            case "keyword":
                // 关键词题目通常中等大小
                adjustedHeight = Math.max(baseHeight, 12.0);
                break;
            case "content_based":
                // 基于内容的分割，使用保守的大小
                adjustedHeight = Math.max(baseHeight, 10.0);
                break;
        }
        
        // 确保边界在合理范围内
        adjustedTop = Math.max(2.0, Math.min(adjustedTop, 85.0));
        adjustedHeight = Math.max(6.0, Math.min(adjustedHeight, 30.0));
        
        // 避免边界重叠（简单处理）
        if (adjustedTop + adjustedHeight > 98.0) {
            adjustedHeight = 98.0 - adjustedTop;
        }
        
        return new QuestionBounds(adjustedTop, adjustedLeft, adjustedWidth, adjustedHeight);
    }
    
    /**
     * 自适应位置计算
     */
    private double calculateAdaptivePosition(int lineNumber, int totalLines) {
        // 非线性分布：开头和结尾留更多空间
        double ratio = (double) lineNumber / totalLines;
        double startMargin = 8.0; // 顶部留8%空间
        double endMargin = 8.0;   // 底部留8%空间
        double availableSpace = 100.0 - startMargin - endMargin;
        
        // 使用平滑曲线分布
        double smoothRatio = smoothStep(ratio);
        return startMargin + (availableSpace * smoothRatio);
    }
    
    /**
     * 自适应高度计算
     */
    private double calculateAdaptiveHeight(QuestionInfo questionInfo, String[] lines, 
                                         int startLine, int endLine) {
        int lineCount = endLine - startLine + 1;
        
        // 基础高度：根据行数计算
        double baseHeight = lineCount * 4.0; // 每行约4%
        
        // 根据内容长度调整
        int totalContentLength = 0;
        for (int i = startLine; i <= endLine && i < lines.length; i++) {
            totalContentLength += lines[i].trim().length();
        }
        
        // 内容越长，需要的空间越大
        if (totalContentLength > 200) {
            baseHeight += 3.0;
        } else if (totalContentLength > 100) {
            baseHeight += 1.5;
        }
        
        // 根据题目类型调整
        switch (questionInfo.type) {
            case "numbered":
                baseHeight = Math.max(baseHeight, 12.0); // 大题最小12%
                break;
            case "parentheses":
                baseHeight = Math.max(baseHeight, 6.0);  // 子题最小6%
                break;
            default:
                baseHeight = Math.max(baseHeight, 8.0);  // 其他最小8%
        }
        
        return Math.min(baseHeight, 25.0); // 最大不超过25%
    }
    
    /**
     * 平滑步骤函数，用于更自然的位置分布
     */
    private double smoothStep(double x) {
        return x * x * (3.0 - 2.0 * x);
    }
    
    /**
     * 题目信息类
     */
    private static class QuestionInfo {
        int questionNumber;
        int startLine;
        String type;
        
        QuestionInfo(int questionNumber, int startLine, String type) {
            this.questionNumber = questionNumber;
            this.startLine = startLine;
            this.type = type;
        }
    }
    

    
    /**
     * 评估题目难度
     */
    private boolean assessQuestionDifficulty(String content) {
        // 根据关键词判断难度
        String[] difficultKeywords = {"函数", "证明", "求证", "区间", "最值", "导数", "积分"};
        String[] complexSymbols = {"²", "³", "∞", "∑", "∫", "∂"};
        
        for (String keyword : difficultKeywords) {
            if (content.contains(keyword)) return true;
        }
        
        for (String symbol : complexSymbols) {
            if (content.contains(symbol)) return true;
        }
        
        // 题目长度也是难度指标
        return content.length() > 80;
    }
    

    
    /**
     * 根据题目复杂度计算置信度
     */
    private double calculateConfidenceByComplexity(String text) {
        double baseConfidence = 0.85;
        
        // 题目越长，OCR识别可能越不准确
        if (text.length() > 100) {
            baseConfidence -= 0.1;
        } else if (text.length() > 60) {
            baseConfidence -= 0.05;
        }
        
        // 包含数学符号降低置信度
        if (text.contains("∞") || text.contains("²") || text.contains("₁") || text.contains("₂")) {
            baseConfidence -= 0.03;
        }
        
        // 包含括号和公式
        if (text.contains("f(x)") || text.contains("g(x)")) {
            baseConfidence -= 0.02;
        }
        
        // 确保置信度在合理范围内
        return Math.max(0.70, Math.min(0.95, baseConfidence + random.nextGaussian() * 0.02));
    }

    /**
     * 真实的OCR识别（调用阿里云OCR API）
     */
    private OCRResult performRealOCR(MultipartFile file) {
        try {
            // 检查OCR配置
            if (accessKeyId == null || accessKeyId.equals("not-configured") || 
                accessKeySecret == null || accessKeySecret.equals("not-configured")) {
                
                log.warn("OCR服务未正确配置，请设置阿里云访问凭证");
                String errorMessage = "OCR服务未配置。请按以下步骤配置：\n" +
                    "1. 在阿里云控制台创建AccessKey\n" +
                    "2. 开通OCR服务\n" +
                    "3. 在application.yml中设置access-key-id和access-key-secret\n" +
                    "4. 取消注释pom.xml中的阿里云依赖";
                
                return new OCRResult(false, "", 0.0, errorMessage);
            }
            
            // 实现真实的阿里云OCR API调用
            return performAliyunOCR(file);
            
        } catch (Exception e) {
            log.error("OCR识别过程异常", e);
            return new OCRResult(false, "", 0.0, "OCR识别异常：" + e.getMessage());
        }
    }
    
    /**
     * 执行阿里云OCR识别
     */
    private OCRResult performAliyunOCR(MultipartFile file) {
        try {
            log.info("开始调用阿里云OCR API进行文字识别");
            
            // 配置认证信息，延长超时时间
            Config config = new Config()
                    .setAccessKeyId(accessKeyId)
                    .setAccessKeySecret(accessKeySecret)
                    .setEndpoint("ocr-api.cn-hangzhou.aliyuncs.com")
                    .setConnectTimeout(120000)  // 连接超时2分钟
                    .setReadTimeout(300000);    // 读取超时5分钟

            // 创建客户端
            Client client = new Client(config);

            // 创建请求对象
            RecognizeAllTextRequest request = new RecognizeAllTextRequest()
                    .setType("Advanced")
                    .setBody(new ByteArrayInputStream(file.getBytes()));
                
            log.info("发送OCR请求到阿里云...");
            
            // 记录开始时间
            long startTime = System.currentTimeMillis();
            
            // 调用OCR API
            RecognizeAllTextResponse response = client.recognizeAllText(request);
            
            long endTime = System.currentTimeMillis();
            log.info("收到OCR响应，耗时: {} 毫秒", (endTime - startTime));

            // 处理响应
            String extractedText = extractTextFromResponse(response);
            
            if (extractedText == null || extractedText.trim().isEmpty()) {
                log.warn("无法从OCR结果中提取文本");
                return new OCRResult(false, "", 0.0, "无法从图片中提取文字，请尝试使用更清晰的图片");
            }
            
            double confidence = 0.85; // 默认置信度
            log.info("OCR识别成功，识别文字长度：{}，置信度：{}", extractedText.length(), confidence);
            return new OCRResult(true, extractedText.trim(), confidence, null);
            
        } catch (Exception e) {
            log.error("阿里云OCR调用异常", e);
            return new OCRResult(false, "", 0.0, "OCR调用异常：" + e.getMessage());
        }
    }
    
    /**
     * 从OCR响应中提取文本
     */
    private String extractTextFromResponse(RecognizeAllTextResponse response) {
        try {
            // 转换为JSON并解析
            String jsonResponse = new Gson().toJson(response);
            log.debug("OCR 完整响应: {}", jsonResponse);
            
            Map<String, Object> jsonMap = new Gson().fromJson(jsonResponse, Map.class);
            
            // 导航到数据部分
            if (jsonMap.containsKey("body") && jsonMap.get("body") instanceof Map) {
                Map<String, Object> body = (Map<String, Object>) jsonMap.get("body");
                
                if (body.containsKey("data") && body.get("data") instanceof Map) {
                    Map<String, Object> data = (Map<String, Object>) body.get("data");
                    
                    // 尝试获取主要内容
                    if (data.containsKey("content") && data.get("content") != null) {
                        return String.valueOf(data.get("content"));
                    }
                    
                    // 如果主要内容为空，尝试从子图像获取
                    if (data.containsKey("subImages") && data.get("subImages") instanceof List) {
                        List<Map<String, Object>> subImages = (List<Map<String, Object>>) data.get("subImages");
                        StringBuilder allText = new StringBuilder();
                        
                        for (Map<String, Object> subImage : subImages) {
                            // 获取子图像内容
                            if (subImage.containsKey("content") && subImage.get("content") != null) {
                                String content = String.valueOf(subImage.get("content"));
                                if (content != null && !content.isEmpty()) {
                                    allText.append(content).append("\n");
                                }
                            }
                            
                            // 获取块信息
                            if (subImage.containsKey("blockInfo") && subImage.get("blockInfo") instanceof Map) {
                                Map<String, Object> blockInfo = (Map<String, Object>) subImage.get("blockInfo");
                                if (blockInfo.containsKey("blockDetails") && 
                                    blockInfo.get("blockDetails") instanceof List) {
                                    
                                    List<Map<String, Object>> blockDetails = 
                                        (List<Map<String, Object>>) blockInfo.get("blockDetails");
                                    
                                    for (Map<String, Object> block : blockDetails) {
                                        if (block.containsKey("blockContent")) {
                                            String blockContent = String.valueOf(block.get("blockContent"));
                                            if (blockContent != null && !blockContent.isEmpty()) {
                                                allText.append(blockContent).append("\n");
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        return allText.toString().trim();
                    }
                }
            }
            
            return null;
            
        } catch (Exception e) {
            log.error("处理OCR响应时出错", e);
            return null;
        }
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
                contentType.contains("bmp"));
    }

    /**
     * OCR识别结果
     */
    public static class OCRResult {
        private final boolean success;
        private final String text;
        private final double confidence;
        private final String error;

        public OCRResult(boolean success, String text, double confidence, String error) {
            this.success = success;
            this.text = text;
            this.confidence = confidence;
            this.error = error;
        }

        public boolean isSuccess() { return success; }
        public String getText() { return text; }
        public double getConfidence() { return confidence; }
        public String getError() { return error; }
    }

    /**
     * 题目分割识别结果
     */
    public static class QuestionSegmentResult {
        private final boolean success;
        private final List<QuestionSegment> questions;
        private final String error;
        private final double overallConfidence;

        public QuestionSegmentResult(boolean success, List<QuestionSegment> questions, String error) {
            this.success = success;
            this.questions = questions;
            this.error = error;
            this.overallConfidence = 0.0;
        }

        public QuestionSegmentResult(boolean success, List<QuestionSegment> questions, String error, double overallConfidence) {
            this.success = success;
            this.questions = questions;
            this.error = error;
            this.overallConfidence = overallConfidence;
        }

        public boolean isSuccess() { return success; }
        public List<QuestionSegment> getQuestions() { return questions; }
        public String getError() { return error; }
        public double getOverallConfidence() { return overallConfidence; }
    }

    /**
     * 单个题目分割信息
     */
    public static class QuestionSegment {
        private final int id;
        private final String text;
        private final QuestionBounds bounds;
        private final double confidence;
        private final boolean isDifficult; // 是否为疑难题目

        public QuestionSegment(int id, String text, QuestionBounds bounds, double confidence, boolean isDifficult) {
            this.id = id;
            this.text = text;
            this.bounds = bounds;
            this.confidence = confidence;
            this.isDifficult = isDifficult;
        }

        public int getId() { return id; }
        public String getText() { return text; }
        public QuestionBounds getBounds() { return bounds; }
        public double getConfidence() { return confidence; }
        public boolean isDifficult() { return isDifficult; }
    }

    /**
     * 题目边界信息（百分比坐标）
     */
    public static class QuestionBounds {
        private final double top;    // 顶部位置（百分比）
        private final double left;   // 左侧位置（百分比）
        private final double width;  // 宽度（百分比）
        private final double height; // 高度（百分比）

        public QuestionBounds(double top, double left, double width, double height) {
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