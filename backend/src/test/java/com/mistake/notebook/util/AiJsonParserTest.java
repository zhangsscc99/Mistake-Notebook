package com.mistake.notebook.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiJsonParserTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void salvageTruncatedAnalysisKeepsAnswer() {
        String truncated = """
                { "answer": "C", "analysis": "题目要求判断哪一组向量**不是正交基**。已知 (α₁, α₂, α₃) 是线性空间的一组**正交基**，即满足：αᵢ·αⱼ = 0（i≠j），且每个 αᵢ ≠ 0。
                重审题干：‘存在可逆矩阵 M，以下向量组不是正交基的是（C）’——这句话语法略歧义，但结合选项和常规命题逻辑，应理解为：
                > 设 (α₁,α₂,α₃) 是某内积空间的一组正交基；对于给定的选项，判断哪一个**无论 M 如何选取（或在该构造下）都不可能是正交基**；而其他选项**存在某个可""";

        JsonNode node = AiJsonParser.parseObject(mapper, truncated);
        assertNotNull(node);
        assertEquals("C", node.path("answer").asText());
        assertTrue(node.path("analysis").asText().contains("不是正交基"));
    }

    @Test
    void parsesCompleteJson() {
        JsonNode node = AiJsonParser.parseObject(mapper, "{\"answer\":\"B\",\"analysis\":\"配方法\",\"confidence\":0.9}");
        assertEquals("B", node.path("answer").asText());
        assertEquals("配方法", node.path("analysis").asText());
        assertEquals(0.9, node.path("confidence").asDouble(), 0.001);
    }

    @Test
    void unwrapsMarkdownFence() {
        JsonNode node = AiJsonParser.parseObject(mapper, "```json\n{\"answer\":\"A\",\"analysis\":\"口算\"}\n```");
        assertEquals("A", node.path("answer").asText());
    }
}
