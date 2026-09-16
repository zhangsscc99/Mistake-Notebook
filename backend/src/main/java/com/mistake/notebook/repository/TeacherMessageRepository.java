package com.mistake.notebook.repository;

import com.mistake.notebook.entity.TeacherMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TeacherMessageRepository extends JpaRepository<TeacherMessage, Long> {
    List<TeacherMessage> findByTeacherIdAndStudentIdOrderByCreatedAtAsc(Long teacherId, Long studentId);
    long countByTeacherIdAndSenderRoleAndReadAtIsNull(Long teacherId, String senderRole);
    long countByStudentIdAndSenderRoleAndReadAtIsNull(Long studentId, String senderRole);
    long countByTeacherIdAndStudentIdAndSenderRoleAndReadAtIsNull(Long teacherId, Long studentId, String senderRole);
    void deleteByStudentId(Long studentId);
    void deleteByTeacherId(Long teacherId);
}
