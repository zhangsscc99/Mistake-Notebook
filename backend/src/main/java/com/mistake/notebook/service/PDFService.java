package com.mistake.notebook.service;

import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Text;
import com.itextpdf.layout.properties.TextAlignment;
import com.mistake.notebook.dto.QuestionDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

/**
 * PDF试卷生成服务
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PDFService {

    @Value("${file.upload.path}")
    private String uploadPath;

    /**
     * 生成试卷PDF
     */
    public byte[] generateTestPaper(String title, String duration, String totalScore, List<QuestionDTO> questions) {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            Document document = new Document(pdfDoc);

            // 设置字体（使用内置字体，避免中文问题）
            PdfFont font = PdfFontFactory.createFont();

            // 试卷标题
            Paragraph titleParagraph = new Paragraph(title != null ? title : "数学试卷")
                    .setFont(font)
                    .setFontSize(20)
                    .setBold()
                    .setTextAlignment(TextAlignment.CENTER);
            document.add(titleParagraph);

            // 试卷信息
            String info = String.format("考试时间：%s分钟    总分：%s分    题目数量：%d道题",
                    duration != null ? duration : "120",
                    totalScore != null ? totalScore : "100",
                    questions.size());
            
            Paragraph infoParagraph = new Paragraph(info)
                    .setFont(font)
                    .setFontSize(12)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setMarginBottom(20);
            document.add(infoParagraph);

            // 添加题目
            for (int i = 0; i < questions.size(); i++) {
                QuestionDTO question = questions.get(i);
                
                // 题目编号和分类
                Paragraph questionHeader = new Paragraph()
                        .add(new Text(String.format("%d. ", i + 1)).setBold())
                        .add(new Text(String.format("(%s) ", question.getCategory())).setItalic())
                        .add(new Text("[10分]").setBold())
                        .setFont(font)
                        .setFontSize(14)
                        .setMarginTop(15);
                document.add(questionHeader);

                // 题目内容
                Paragraph questionContent = new Paragraph(question.getContent())
                        .setFont(font)
                        .setFontSize(12)
                        .setMarginBottom(10);
                document.add(questionContent);

                // 答题区域（空行）
                for (int j = 0; j < 3; j++) {
                    document.add(new Paragraph(" ").setFont(font).setFontSize(12));
                }
            }

            document.close();
            
            log.info("PDF试卷生成成功，共{}道题目", questions.size());
            return baos.toByteArray();

        } catch (IOException e) {
            log.error("生成PDF试卷失败", e);
            throw new RuntimeException("PDF生成失败：" + e.getMessage());
        }
    }

    /**
     * 生成答案PDF（可选功能）
     */
    public byte[] generateAnswerSheet(String title, List<QuestionDTO> questions) {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            Document document = new Document(pdfDoc);

            PdfFont font = PdfFontFactory.createFont();

            // 答案页标题
            Paragraph titleParagraph = new Paragraph((title != null ? title : "数学试卷") + " - 参考答案")
                    .setFont(font)
                    .setFontSize(18)
                    .setBold()
                    .setTextAlignment(TextAlignment.CENTER)
                    .setMarginBottom(20);
            document.add(titleParagraph);

            // 答案列表
            for (int i = 0; i < questions.size(); i++) {
                QuestionDTO question = questions.get(i);
                
                Paragraph answerItem = new Paragraph()
                        .add(new Text(String.format("%d. ", i + 1)).setBold())
                        .add(new Text("参考答案："))
                        .add(new Text("（答案需要人工添加）").setItalic())
                        .setFont(font)
                        .setFontSize(12)
                        .setMarginBottom(10);
                document.add(answerItem);
            }

            document.close();
            
            log.info("PDF答案页生成成功");
            return baos.toByteArray();

        } catch (IOException e) {
            log.error("生成PDF答案页失败", e);
            throw new RuntimeException("PDF生成失败：" + e.getMessage());
        }
    }
} 