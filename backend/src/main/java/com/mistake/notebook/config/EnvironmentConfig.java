package com.mistake.notebook.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import jakarta.annotation.PostConstruct;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Properties;

/**
 * 环境配置类 - 加载.env文件
 */
@Configuration
@Slf4j
public class EnvironmentConfig {

    private final Environment environment;

    public EnvironmentConfig(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    public void loadEnvironmentVariables() {
        try {
            // 尝试加载.env文件
            String envFilePath = ".env";
            if (Files.exists(Paths.get(envFilePath))) {
                Properties envProps = new Properties();
                try (FileInputStream fis = new FileInputStream(envFilePath)) {
                    envProps.load(fis);
                    
                    // 设置系统属性
                    for (String key : envProps.stringPropertyNames()) {
                        String value = envProps.getProperty(key);
                        if (System.getProperty(key) == null) {
                            System.setProperty(key, value);
                        }
                    }
                    
                    log.info("成功加载.env文件，包含{}个配置项", envProps.size());
                    
                    // 验证关键配置
                    String apiKey = System.getProperty("DASHSCOPE_API_KEY");
                    if (apiKey != null && !apiKey.equals("not-configured")) {
                        log.info("DashScope API Key已配置: {}...", apiKey.substring(0, Math.min(20, apiKey.length())));
                    } else {
                        log.warn("DashScope API Key未配置或配置不正确");
                    }
                    
                } catch (IOException e) {
                    log.error("读取.env文件失败", e);
                }
            } else {
                log.info(".env文件不存在，使用默认环境变量");
            }
        } catch (Exception e) {
            log.error("加载环境变量失败", e);
        }
    }
}
