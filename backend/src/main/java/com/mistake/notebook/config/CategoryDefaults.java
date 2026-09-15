package com.mistake.notebook.config;

import java.util.List;

public final class CategoryDefaults {

    public static final List<Item> ITEMS = List.of(
            new Item("数学", "数学相关题目", "#E8A855"),
            new Item("物理", "物理相关题目", "#4A90E2"),
            new Item("化学", "化学相关题目", "#7ED321"),
            new Item("英语", "英语相关题目", "#F5A623"),
            new Item("语文", "语文相关题目", "#BD10E0"),
            new Item("生物", "生物相关题目", "#50E3C2"),
            new Item("历史", "历史相关题目", "#D0021B"),
            new Item("地理", "地理相关题目", "#8B572A"),
            new Item("计算机/编程", "计算机与编程相关题目", "#2A9D8F"),
            new Item("政治", "政治相关题目", "#C471ED")
    );

    private CategoryDefaults() {}

    public record Item(String name, String description, String color) {}
}
