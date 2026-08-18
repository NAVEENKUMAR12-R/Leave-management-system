package com.leavemanagement.repository;

import com.leavemanagement.model.LeaveRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {
    List<LeaveRequest> findByApplicantId(Long applicantId);
    List<LeaveRequest> findByApproverId(Long approverId);
}
