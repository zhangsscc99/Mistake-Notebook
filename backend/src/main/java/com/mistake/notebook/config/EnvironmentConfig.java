package com.mistake.notebook.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

/**
 * 环境配置类 - 在 Spring Boot 启动前加载.env文件
 */
@Slf4j
public class EnvironmentConfig implements ApplicationListener<ApplicationEnvironmentPreparedEvent> {

    @Override
    public void onApplicationEvent(ApplicationEnvironmentPreparedEvent event) {
        loadEnvironmentVariables(event.getEnvironment());
    }

    private void loadEnvironmentVariables(ConfigurableEnvironment environment) {
        try {
            // 尝试加载.env文件
            String envFilePath = ".env";
            if (Files.exists(Paths.get(envFilePath))) {
                Map<String, Object> envMap = new HashMap<>();
                
                // 手动解析 .env 文件
                String content = new String(Files.readAllBytes(Paths.get(envFilePath)), "UTF-8");
                for (String line : content.split("\n")) {
                    line = line.trim();
                    if (line.isEmpty() || line.startsWith("#")) {
                        continue;
                    }
                    int eqIndex = line.indexOf('=');
                    if (eqIndex > 0) {
                        String key = line.substring(0, eqIndex).trim();
                        String value = line.substring(eqIndex + 1).trim();
                        // 移除引号（如果有）
                        if ((value.startsWith("\"") && value.endsWith("\"")) ||
                            (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.substring(1, value.length() - 1);
                        }
                        envMap.put(key, value);
                    }
                }
                
                // 添加到 Spring Environment（优先级最高）
                environment.getPropertySources().addFirst(
                    new MapPropertySource("envFile", envMap)
                );
                
                // 同时设置系统属性（作为备用）
                for (Map.Entry<String, Object> entry : envMap.entrySet()) {
                    if (System.getProperty(entry.getKey()) == null) {
                        System.setProperty(entry.getKey(), entry.getValue().toString());
                    }
                }
                
                log.info("成功加载.env文件，包含{}个配置项", envMap.size());
                
                // 验证关键配置
                String dbPassword = (String) envMap.get("DB_PASSWORD");
                if (dbPassword != null && !dbPassword.equals("password")) {
                    log.info("数据库密码已从.env文件加载");
                } else {
                    log.warn("数据库密码未从.env文件加载");
                }
                
                String apiKey = (String) envMap.get("DASHSCOPE_API_KEY");
                if (apiKey != null && !apiKey.equals("not-configured")) {
                    log.info("DashScope API Key已配置: {}...", apiKey.substring(0, Math.min(20, apiKey.length())));
                } else {
                    log.warn("DashScope API Key未配置或配置不正确");
                }
                
            } else {
                log.warn(".env文件不存在于: {}，使用默认环境变量", Paths.get(envFilePath).toAbsolutePath());
            }
        } catch (IOException e) {
            log.error("读取.env文件失败", e);
        } catch (Exception e) {
            log.error("加载环境变量失败", e);
        }
    }
}
