package com.leavemanagement.repository;

import com.leavemanagement.model.LeaveRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {
    List<LeaveRequest> findByApplicantId(Long applicantId);
    List<LeaveRequest> findByManagerApproverId(Long managerApproverId);
    List<LeaveRequest> findByApplicantManagerId(Long managerId);
    List<LeaveRequest> findByHrApproverId(Long hrApproverId);
    List<LeaveRequest> findByStatus(String status);

    @Query("SELECT lr FROM LeaveRequest lr WHERE lr.status = 'PENDING_MANAGER' AND lr.managerApprover.id = :managerId")
    List<LeaveRequest> findPendingLeavesToApproveByManager(@Param("managerId") Long managerId);

    @Query("SELECT lr FROM LeaveRequest lr WHERE lr.status = 'PENDING_HR' AND lr.applicant.id <> :hrId")
    List<LeaveRequest> findPendingLeavesToApproveByHR(@Param("hrId") Long hrId);

    @Query("SELECT lr FROM LeaveRequest lr WHERE lr.status = 'PENDING_ADMIN' AND lr.applicant.id <> :adminId")
    List<LeaveRequest> findPendingLeavesToApproveByAdmin(@Param("adminId") Long adminId);
}
