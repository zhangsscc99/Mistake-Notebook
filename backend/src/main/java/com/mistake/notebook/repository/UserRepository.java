package com.mistake.notebook.repository;

import com.mistake.notebook.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    List<User> findByLeaderboardPublicTrue();
    Optional<User> findByInviteCode(String inviteCode);
}
