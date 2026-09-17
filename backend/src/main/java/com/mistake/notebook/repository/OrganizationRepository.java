package com.mistake.notebook.repository;

import com.mistake.notebook.entity.Organization;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {
    Optional<Organization> findBySlug(String slug);
    Optional<Organization> findByOwnerId(Long ownerId);
    boolean existsBySlug(String slug);
    List<Organization> findAllByOrderByDemoDescCreatedAtDesc();
    void deleteByOwnerId(Long ownerId);
}
