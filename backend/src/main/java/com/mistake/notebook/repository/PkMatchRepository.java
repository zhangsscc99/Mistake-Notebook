package com.mistake.notebook.repository;

import com.mistake.notebook.entity.PkMatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PkMatchRepository extends JpaRepository<PkMatch, Long> {
    Optional<PkMatch> findByChallengerIdAndOpponentIdAndStatus(Long challengerId, Long opponentId, String status);

    @Query("SELECT m FROM PkMatch m WHERE m.challengerId = :uid OR m.opponentId = :uid ORDER BY m.createdAt DESC")
    List<PkMatch> findRecentByUser(@Param("uid") Long userId);

    List<PkMatch> findByOpponentIdAndStatusOrderByCreatedAtDesc(Long opponentId, String status);

    void deleteByChallengerIdOrOpponentId(Long challengerId, Long opponentId);
}
