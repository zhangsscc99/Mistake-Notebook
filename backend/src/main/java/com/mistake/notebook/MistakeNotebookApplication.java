package com.mistake.notebook;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * 错题本整理系统主启动类
 */
@SpringBootApplication
@EnableJpaAuditing
public class MistakeNotebookApplication {

    public static void main(String[] args) {
        SpringApplication.run(MistakeNotebookApplication.class, args);
        System.out.println("\n" +
                "================================\n" +
                "  错题本整理系统启动成功！\n" +
                "  前端地址: http://localhost:3000\n" +
                "  后端地址: http://localhost:8080/api\n" +
                "  H2控制台: http://localhost:8080/api/h2-console\n" +
                "================================\n");
    }
} 