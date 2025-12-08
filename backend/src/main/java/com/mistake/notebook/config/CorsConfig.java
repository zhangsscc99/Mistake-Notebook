package com.mistake.notebook.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;

/**
 * 跨域配置
 */
@Configuration
public class CorsConfig {

    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    @Value("${cors.allowed-methods}")
    private String allowedMethods;

    @Value("${cors.allowed-headers}")
    private String allowedHeaders;

    @Value("${cors.allow-credentials}")
    private boolean allowCredentials;

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        
        // 处理允许的源
        String[] origins = allowedOrigins.split(",");
        java.util.List<String> originList = new java.util.ArrayList<>();
        boolean hasWildcard = false;
        
        for (String origin : origins) {
            String trimmed = origin.trim();
            if ("*".equals(trimmed)) {
                hasWildcard = true;
                break;
            } else if (!trimmed.isEmpty()) {
                originList.add(trimmed);
            }
        }
        
        // 如果有通配符，允许所有来源
        if (hasWildcard) {
            config.addAllowedOriginPattern("*");
            // 使用通配符时不能设置 allowCredentials
            config.setAllowCredentials(false);
        } else {
            // 使用精确匹配
            config.setAllowedOrigins(originList);
            config.setAllowCredentials(allowCredentials);
        }
        
        // 允许的方法
        config.setAllowedMethods(Arrays.asList(allowedMethods.split(",")));
        
        // 允许的头部
        config.setAllowedHeaders(Arrays.asList(allowedHeaders.split(",")));
        
        // 预检请求的有效期
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        
        return new CorsFilter(source);
    }
} 