package com.mistake.notebook.service;

import com.mistake.notebook.config.CategoryDefaults;
import com.mistake.notebook.entity.Category;
import com.mistake.notebook.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CategorySeedService {

    private final CategoryRepository categoryRepository;

    @Transactional
    public int seedForUser(long userId) {
        int created = 0;
        LocalDateTime now = LocalDateTime.now();
        for (CategoryDefaults.Item item : CategoryDefaults.ITEMS) {
            boolean exists = categoryRepository
                    .findByUserIdAndNameAndIsDeleted(userId, item.name(), false)
                    .isPresent();
            if (exists) continue;
            Category cat = new Category();
            cat.setUserId(userId);
            cat.setName(item.name());
            cat.setDescription(item.description());
            cat.setColor(item.color());
            cat.setQuestionCount(0);
            cat.setIsDeleted(false);
            cat.setCreatedAt(now);
            cat.setUpdatedAt(now);
            categoryRepository.save(cat);
            created++;
        }
        return created;
    }

    public List<Category> listForUser(long userId) {
        seedForUser(userId);
        return categoryRepository.findByUserIdAndIsDeletedFalseOrderByIdAsc(userId);
    }

    public Category findForUser(long userId, String name) {
        List<Category> list = listForUser(userId);
        if (name != null && !name.isBlank()) {
            String want = name.trim();
            for (Category cat : list) {
                if (want.equals(cat.getName())) return cat;
            }
            for (Category cat : list) {
                String n = cat.getName() == null ? "" : cat.getName();
                if (n.contains(want) || want.contains(n)) return cat;
            }
        }
        return list.isEmpty() ? null : list.get(0);
    }
}
