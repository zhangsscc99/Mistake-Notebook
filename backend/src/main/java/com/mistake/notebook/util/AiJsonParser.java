package com.mistake.notebook.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Models often hit max_tokens mid-JSON (unclosed analysis string).
 * Recover answer/analysis instead of failing the whole parse.
 */
public final class AiJsonParser {

    private AiJsonParser() {}

    public static JsonNode parseObject(ObjectMapper mapper, String raw) {
        if (mapper == null || raw == null || raw.isBlank()) {
            return null;
        }
        String json = unwrap(raw);
        if (json.isBlank()) {
            return null;
        }
        JsonNode node = tryRead(mapper, json);
        if (isObject(node)) {
            return node;
        }
        node = tryRead(mapper, repair(json));
        if (isObject(node)) {
            return node;
        }
        return objectFromLooseFields(mapper, json);
    }

    public static String unwrap(String raw) {
        String s = raw.trim();
        if (s.startsWith("```")) {
            int nl = s.indexOf('\n');
            if (nl >= 0) {
                s = s.substring(nl + 1);
            }
            int fence = s.lastIndexOf("```");
            if (fence >= 0) {
                s = s.substring(0, fence);
            }
            s = s.trim();
        }
        int start = s.indexOf('{');
        return start >= 0 ? s.substring(start) : s;
    }

    static String repair(String json) {
        StringBuilder out = new StringBuilder(json.trim());
        while (out.length() > 0 && Character.isWhitespace(out.charAt(out.length() - 1))) {
            out.setLength(out.length() - 1);
        }
        if (isInsideString(out)) {
            int slashes = 0;
            for (int i = out.length() - 1; i >= 0 && out.charAt(i) == '\\'; i--) {
                slashes++;
            }
            if (slashes % 2 == 1) {
                out.append('\\');
            }
            out.append('"');
        }
        while (out.length() > 0) {
            char last = out.charAt(out.length() - 1);
            if (Character.isWhitespace(last) || last == ',') {
                out.setLength(out.length() - 1);
                continue;
            }
            break;
        }
        int braces = 0;
        int brackets = 0;
        boolean inString = false;
        for (int i = 0; i < out.length(); i++) {
            char c = out.charAt(i);
            if (inString) {
                if (c == '\\') {
                    i++;
                    continue;
                }
                if (c == '"') {
                    inString = false;
                }
                continue;
            }
            if (c == '"') {
                inString = true;
            } else if (c == '{') {
                braces++;
            } else if (c == '}') {
                braces--;
            } else if (c == '[') {
                brackets++;
            } else if (c == ']') {
                brackets--;
            }
        }
        while (brackets > 0) {
            out.append(']');
            brackets--;
        }
        while (braces > 0) {
            out.append('}');
            braces--;
        }
        return out.toString();
    }

    private static boolean isInsideString(CharSequence s) {
        boolean inString = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (inString) {
                if (c == '\\') {
                    i++;
                    continue;
                }
                if (c == '"') {
                    inString = false;
                }
            } else if (c == '"') {
                inString = true;
            }
        }
        return inString;
    }

    private static JsonNode tryRead(ObjectMapper mapper, String json) {
        try {
            return mapper.readTree(json);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static boolean isObject(JsonNode node) {
        return node != null && node.isObject();
    }

    private static JsonNode objectFromLooseFields(ObjectMapper mapper, String json) {
        String answer = extractJsonStringField(json, "answer");
        String analysis = extractJsonStringField(json, "analysis");
        if ((answer == null || answer.isBlank()) && (analysis == null || analysis.isBlank())) {
            return null;
        }
        ObjectNode node = mapper.createObjectNode();
        if (answer != null) {
            node.put("answer", answer);
        }
        if (analysis != null) {
            node.put("analysis", analysis);
        }
        Double confidence = extractJsonNumberField(json, "confidence");
        if (confidence != null) {
            node.put("confidence", confidence);
        }
        return node;
    }

    static String extractJsonStringField(String json, String field) {
        String key = "\"" + field + "\"";
        int keyIdx = indexOfFieldKey(json, key);
        if (keyIdx < 0) {
            return null;
        }
        int i = keyIdx + key.length();
        while (i < json.length() && Character.isWhitespace(json.charAt(i))) {
            i++;
        }
        if (i >= json.length() || json.charAt(i) != ':') {
            return null;
        }
        i++;
        while (i < json.length() && Character.isWhitespace(json.charAt(i))) {
            i++;
        }
        if (i >= json.length() || json.charAt(i) != '"') {
            return null;
        }
        i++;
        StringBuilder sb = new StringBuilder();
        while (i < json.length()) {
            char c = json.charAt(i);
            if (c == '\\') {
                if (i + 1 >= json.length()) {
                    break;
                }
                char n = json.charAt(i + 1);
                switch (n) {
                    case 'n' -> sb.append('\n');
                    case 't' -> sb.append('\t');
                    case 'r' -> sb.append('\r');
                    case '"' -> sb.append('"');
                    case '\\' -> sb.append('\\');
                    case '/' -> sb.append('/');
                    default -> sb.append(n);
                }
                i += 2;
                continue;
            }
            if (c == '"') {
                return sb.toString();
            }
            sb.append(c);
            i++;
        }
        return sb.toString();
    }

    static Double extractJsonNumberField(String json, String field) {
        String key = "\"" + field + "\"";
        int keyIdx = indexOfFieldKey(json, key);
        if (keyIdx < 0) {
            return null;
        }
        int i = keyIdx + key.length();
        while (i < json.length() && (Character.isWhitespace(json.charAt(i)) || json.charAt(i) == ':')) {
            i++;
        }
        int start = i;
        while (i < json.length()) {
            char c = json.charAt(i);
            if ((c >= '0' && c <= '9') || c == '.' || c == '-' || c == 'e' || c == 'E' || c == '+') {
                i++;
                continue;
            }
            break;
        }
        if (i == start) {
            return null;
        }
        try {
            return Double.parseDouble(json.substring(start, i));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static int indexOfFieldKey(String json, String key) {
        int from = 0;
        while (from < json.length()) {
            int idx = json.indexOf(key, from);
            if (idx < 0) {
                return -1;
            }
            if (idx == 0 || json.charAt(idx - 1) != '\\') {
                return idx;
            }
            from = idx + key.length();
        }
        return -1;
    }
}
