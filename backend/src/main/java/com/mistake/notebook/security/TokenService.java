package com.mistake.notebook.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Service
public class TokenService {

    @Value("${app.auth.secret:mistake-notebook-web-dev-secret}")
    private String secret;

    @Value("${app.auth.expire-days:30}")
    private int expireDays;

    public String issue(long userId) {
        long exp = System.currentTimeMillis() + expireDays * 24L * 3600_000L;
        String payload = userId + "." + exp;
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString((payload + "." + sign(payload)).getBytes(StandardCharsets.UTF_8));
    }

    public Long parse(String token) {
        if (token == null || token.isBlank()) return null;
        try {
            String raw = new String(Base64.getUrlDecoder().decode(token), StandardCharsets.UTF_8);
            String[] parts = raw.split("\\.");
            if (parts.length != 3) return null;
            String payload = parts[0] + "." + parts[1];
            if (!sign(payload).equals(parts[2])) return null;
            long exp = Long.parseLong(parts[1]);
            if (exp < System.currentTimeMillis()) return null;
            return Long.parseLong(parts[0]);
        } catch (Exception e) {
            return null;
        }
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] out = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : out) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("token 签名失败", e);
        }
    }
}
