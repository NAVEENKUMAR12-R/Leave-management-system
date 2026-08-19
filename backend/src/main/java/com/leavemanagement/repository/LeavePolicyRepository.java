package com.leavemanagement.repository;

import com.leavemanagement.model.LeavePolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LeavePolicyRepository extends JpaRepository<LeavePolicy, Long> {
    Optional<LeavePolicy> findByLeaveType(String leaveType);
    List<LeavePolicy> findAllByLeaveType(String leaveType);
}
