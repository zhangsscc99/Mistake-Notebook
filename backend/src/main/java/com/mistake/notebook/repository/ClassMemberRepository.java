package com.mistake.notebook.repository;

import com.mistake.notebook.entity.ClassMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClassMemberRepository extends JpaRepository<ClassMember, Long> {
    List<ClassMember> findByClassIdAndStatusOrderByRequestedAtDesc(Long classId, String status);
    List<ClassMember> findByClassId(Long classId);
    Optional<ClassMember> findByClassIdAndStudentId(Long classId, Long studentId);
    List<ClassMember> findByStudentIdAndStatus(Long studentId, String status);
    List<ClassMember> findByStudentId(Long studentId);
    void deleteByStudentId(Long studentId);
    void deleteByClassId(Long classId);
}
