package com.mistake.notebook.repository;

import com.mistake.notebook.entity.Checkin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CheckinRepository extends JpaRepository<Checkin, Long> {
    Optional<Checkin> findByUserIdAndDayKey(Long userId, String dayKey);
    List<Checkin> findByUserIdOrderByDayKeyDesc(Long userId);
    long countByUserId(Long userId);

    void deleteByUserId(Long userId);
}
