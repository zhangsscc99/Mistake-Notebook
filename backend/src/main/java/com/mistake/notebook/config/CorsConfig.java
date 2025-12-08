package com.mistake.notebook.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

/**
 * 跨域配置
 * 使用最宽松的配置以确保开发环境正常工作
 */
@Configuration
public class CorsConfig {

    private static final Logger logger = LoggerFactory.getLogger(CorsConfig.class);

    @Bean
    public CorsFilter corsFilter() {
        logger.info("🌐 初始化 CORS 配置...");
        
        CorsConfiguration config = new CorsConfiguration();
        
        // 使用 allowedOriginPatterns 允许所有来源（同时支持 allowCredentials）
        config.addAllowedOriginPattern("*");
        logger.info("✅ CORS: 允许所有来源 (allowedOriginPattern=*)");
        
        // 允许携带凭证
        config.setAllowCredentials(true);
        logger.info("✅ CORS: 允许携带凭证 (allowCredentials=true)");
        
        // 允许所有 HTTP 方法
        config.addAllowedMethod("*");
        logger.info("✅ CORS: 允许所有 HTTP 方法");
        
        // 允许所有请求头
        config.addAllowedHeader("*");
        logger.info("✅ CORS: 允许所有请求头");
        
        // 暴露所有响应头
        config.addExposedHeader("*");
        
        // 预检请求的有效期（1小时）
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        
        logger.info("🎉 CORS 配置初始化完成");
        
        return new CorsFilter(source);
    }
} 