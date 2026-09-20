package com.mistake.notebook.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mistake.notebook.dto.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;

@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {

    private final TokenService tokenService;
    private final ObjectMapper objectMapper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI() == null ? "" : request.getRequestURI();
        if (isPublic(path, request.getMethod())) {
            return true;
        }
        String header = request.getHeader("Authorization");
        String token = null;
        if (header != null && header.startsWith("Bearer ")) {
            token = header.substring(7).trim();
        }
        Long userId = tokenService.parse(token);
        if (userId == null) {
            response.setStatus(401);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(objectMapper.writeValueAsString(ApiResponse.error("请先登录", "UNAUTHORIZED")));
            return false;
        }
        AuthContext.setUserId(userId);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        AuthContext.clear();
    }

    private boolean isPublic(String path, String method) {
        if (path.contains("/auth/") || path.contains("/uploads/") || path.endsWith("/error")) {
            return true;
        }
        if (path.contains("/orgs/mine") || path.endsWith("/orgs/joined") || path.endsWith("/orgs/join")) return false;
        return "GET".equalsIgnoreCase(method) && path.contains("/orgs");
    }
}
