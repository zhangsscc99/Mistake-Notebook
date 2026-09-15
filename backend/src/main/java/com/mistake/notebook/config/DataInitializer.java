package com.mistake.notebook.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * 网页端分类按账号播种，启动时不再写入全局题库。
 */
@Component
@Slf4j
public class DataInitializer implements CommandLineRunner {

    @Override
    public void run(String... args) {
        log.info("网页端分类改为按账号播种，启动时不再写入全局题库。");
    }
}
