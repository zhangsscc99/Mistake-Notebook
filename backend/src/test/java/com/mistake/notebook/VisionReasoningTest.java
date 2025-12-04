package com.mistake.notebook;

import com.mistake.notebook.service.VisionReasoningService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;

import java.io.FileInputStream;
import java.io.IOException;

/**
 * 视觉推理服务测试
 */
@SpringBootTest
@ActiveProfiles("dev")
public class VisionReasoningTest {

    @Autowired
    private VisionReasoningService visionReasoningService;

    @Test
    public void testVisionReasoning() throws IOException {
        // 创建测试图片
        byte[] imageBytes = "test image content".getBytes();
        MockMultipartFile file = new MockMultipartFile(
                "file", 
                "test.jpg", 
                "image/jpeg", 
                imageBytes
        );

        // 测试视觉推理
        VisionReasoningService.VisionResult result = visionReasoningService.recognizeText(file);
        
        System.out.println("测试结果:");
        System.out.println("成功: " + result.isSuccess());
        System.out.println("内容: " + result.getContent());
        System.out.println("置信度: " + result.getConfidence());
        if (!result.isSuccess()) {
            System.out.println("错误: " + result.getError());
        }
    }
}
