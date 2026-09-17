package com.mistake.notebook.util;

import com.mistake.notebook.entity.Question;

public final class PaperReadiness {

    private PaperReadiness() {}

    public static boolean forStudentPaper(Question q) {
        if (q == null || Boolean.TRUE.equals(q.getIsDeleted())) {
            return false;
        }
        String status = q.getAiStatus() == null ? "" : q.getAiStatus().name();
        return studentReady(status, q.getAiAnswer(), q.getAiAnalysis());
    }

    public static boolean studentReady(String aiStatus, String aiAnswer, String aiAnalysis) {
        String status = aiStatus == null ? "" : aiStatus.trim();
        if (!status.isEmpty()) {
            String normalized = status.toUpperCase();
            if ("PENDING".equals(normalized)
                    || "PROCESSING".equals(normalized)
                    || "FAILED".equals(normalized)) {
                return false;
            }
        }
        String answer = aiAnswer == null ? "" : aiAnswer.trim();
        if (answer.isEmpty() || "待补充".equals(answer)) {
            return false;
        }
        String analysis = aiAnalysis == null ? "" : aiAnalysis.trim();
        return !analysis.contains("生成异常")
                && !analysis.contains("AI答案生成异常")
                && !analysis.contains("无法解析");
    }

    public static boolean forTeacherPaper(Question q) {
        if (q == null || Boolean.TRUE.equals(q.getIsDeleted())) {
            return false;
        }
        String source = q.getSource() == null ? "" : q.getSource();
        if ("teacher_bank".equals(source)) {
            String content = q.getContent() == null ? "" : q.getContent().trim();
            return !content.isEmpty();
        }
        return forStudentPaper(q);
    }
}
