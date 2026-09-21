package com.mistake.notebook.repository;

import com.mistake.notebook.entity.OrgStaff;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrgStaffRepository extends JpaRepository<OrgStaff, Long> {
    Optional<OrgStaff> findByOrgIdAndTeacherId(Long orgId, Long teacherId);
    List<OrgStaff> findByOrgIdOrderByCreatedAtAsc(Long orgId);
    List<OrgStaff> findByTeacherId(Long teacherId);
    void deleteByOrgId(Long orgId);
    void deleteByTeacherId(Long teacherId);
    void deleteByOrgIdAndTeacherId(Long orgId, Long teacherId);
}
