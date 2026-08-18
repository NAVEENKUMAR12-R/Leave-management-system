package com.leavemanagement.service;

import com.leavemanagement.model.LeaveRequest;
import com.leavemanagement.model.RoleName;
import com.leavemanagement.model.User;
import com.leavemanagement.repository.LeaveRequestRepository;
import com.leavemanagement.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class LeaveService {

    private final LeaveRequestRepository leaveRequestRepository;
    private final UserRepository userRepository;

    public LeaveService(LeaveRequestRepository leaveRequestRepository, UserRepository userRepository) {
        this.leaveRequestRepository = leaveRequestRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public LeaveRequest applyLeave(Long applicantId, LeaveRequest request) {
        User applicant = userRepository.findById(applicantId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        request.setApplicant(applicant);
        request.setStatus("PENDING");
        
        if (applicant.getManager() != null) {
            request.setApprover(applicant.getManager());
        } else {
            request.setApprover(null);
        }

        return leaveRequestRepository.save(request);
    }

    public List<LeaveRequest> getMyLeaves(Long applicantId) {
        return leaveRequestRepository.findByApplicantId(applicantId);
    }

    public List<LeaveRequest> getLeavesToApprove(Long approverId) {
        return leaveRequestRepository.findByApproverId(approverId);
    }

    @Transactional
    public LeaveRequest processLeaveRequest(Long processorId, Long leaveId, String status) {
        LeaveRequest leaveRequest = leaveRequestRepository.findById(leaveId)
                .orElseThrow(() -> new RuntimeException("Leave Request not found"));

        User processor = userRepository.findById(processorId)
                .orElseThrow(() -> new RuntimeException("Processor not found"));
                
        boolean hasHRAccess = processor.getRoles().stream()
                               .anyMatch(r -> r.getRole() == RoleName.HR || r.getRole() == RoleName.HR_ADMIN);

        boolean isAssignedApprover = leaveRequest.getApprover() != null && 
                                     leaveRequest.getApprover().getId().equals(processorId);
                                     
        if (!isAssignedApprover && !hasHRAccess) {
            throw new RuntimeException("You do not have permission to approve this leave request.");
        }

        leaveRequest.setStatus(status);
        return leaveRequestRepository.save(leaveRequest);
    }
}
