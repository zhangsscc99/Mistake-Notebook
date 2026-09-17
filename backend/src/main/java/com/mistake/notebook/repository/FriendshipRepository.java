package com.mistake.notebook.repository;

import com.mistake.notebook.entity.Friendship;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {
    Optional<Friendship> findByUserIdAndFriendId(Long userId, Long friendId);
    List<Friendship> findByUserIdAndStatus(Long userId, String status);
    List<Friendship> findByFriendIdAndStatus(Long friendId, String status);
    long countByUserIdAndStatus(Long userId, String status);
    void deleteByUserIdOrFriendId(Long userId, Long friendId);
    void deleteByUserIdAndFriendId(Long userId, Long friendId);
}
