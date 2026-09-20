package com.mistake.notebook.repository;

import com.mistake.notebook.entity.OrgMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrgMemberRepository extends JpaRepository<OrgMember, Long> {
    Optional<OrgMember> findByOrgIdAndStudentId(Long orgId, Long studentId);
    List<OrgMember> findByOrgIdAndStatusOrderByRequestedAtDesc(Long orgId, String status);
    List<OrgMember> findByStudentId(Long studentId);
    void deleteByStudentId(Long studentId);
    void deleteByOrgId(Long orgId);
}
