package com.mistake.notebook.security;

/**
 * 当前请求的登录用户。网页端用账号隔离数据，对齐小程序的 openid 隔离。
 */
public final class AuthContext {

    private static final ThreadLocal<Long> USER_ID = new ThreadLocal<>();

    private AuthContext() {}

    public static void setUserId(Long userId) {
        USER_ID.set(userId);
    }

    public static Long getUserId() {
        return USER_ID.get();
    }

    public static long requireUserId() {
        Long id = USER_ID.get();
        if (id == null) {
            throw new UnauthorizedException("请先登录");
        }
        return id;
    }

    public static void clear() {
        USER_ID.remove();
    }
}
