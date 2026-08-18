package com.leavemanagement.service;

import com.leavemanagement.model.LeaveBalance;
import com.leavemanagement.model.LeaveRequest;
import com.leavemanagement.model.RoleName;
import com.leavemanagement.model.User;
import com.leavemanagement.payload.TimeOffRequestDTO;
import com.leavemanagement.payload.TimeOffResponseDTO;
import com.leavemanagement.repository.LeaveBalanceRepository;
import com.leavemanagement.repository.LeaveRequestRepository;
import com.leavemanagement.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class LeaveService {

    private final LeaveRequestRepository leaveRequestRepository;
    private final UserRepository userRepository;
    private final CalendarService calendarService;
    private final LeaveBalanceRepository leaveBalanceRepository;

    public LeaveService(LeaveRequestRepository leaveRequestRepository, UserRepository userRepository,
                        CalendarService calendarService, LeaveBalanceRepository leaveBalanceRepository) {
        this.leaveRequestRepository = leaveRequestRepository;
        this.userRepository = userRepository;
        this.calendarService = calendarService;
        this.leaveBalanceRepository = leaveBalanceRepository;
    }

    @Transactional
    public TimeOffResponseDTO applyLeave(Long applicantId, TimeOffRequestDTO requestDTO) {
        User applicant = userRepository.findById(applicantId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        double workingDays = calendarService.calculateWorkingDays(requestDTO.getStartDate(), requestDTO.getEndDate());
        if (workingDays <= 0) {
            throw new RuntimeException("Leave duration must be at least 1 working day.");
        }

        if (!"UNPAID".equals(requestDTO.getTimeOffType())) {
            LeaveBalance balance = leaveBalanceRepository.findByUserIdAndLeaveType(applicantId, requestDTO.getTimeOffType())
                    .orElseThrow(() -> new RuntimeException("Leave balance not found"));
            if (balance.getTotalLeaves() - balance.getUsedLeaves() < workingDays) {
                throw new RuntimeException("Insufficient paid leave balance");
            }
        }

        LeaveRequest request = new LeaveRequest();
        request.setApplicant(applicant);
        request.setStartDate(requestDTO.getStartDate());
        request.setEndDate(requestDTO.getEndDate());
        request.setLeaveType(requestDTO.getTimeOffType());
        request.setReason(requestDTO.getReason());
        request.setTotalDays(workingDays);

        if (applicant.getManager() != null) {
            request.setManagerApprover(applicant.getManager());
            request.setStatus("PENDING_MANAGER");
        } else {
            request.setStatus("PENDING_HR");
        }

        LeaveRequest saved = leaveRequestRepository.save(request);
        return mapToDTO(saved);
    }

    public List<TimeOffResponseDTO> getMyLeaves(Long applicantId) {
        return leaveRequestRepository.findByApplicantId(applicantId)
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<TimeOffResponseDTO> getLeavesToApproveByManager(Long managerId) {
        return leaveRequestRepository.findByManagerApproverId(managerId)
                .stream()
                .filter(req -> "PENDING_MANAGER".equals(req.getStatus()))
                .map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<TimeOffResponseDTO> getLeavesToApproveByHR() {
        return leaveRequestRepository.findByStatus("PENDING_HR")
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Transactional
    public TimeOffResponseDTO processLeaveRequest(Long processorId, Long leaveId, String action) {
        LeaveRequest leaveRequest = leaveRequestRepository.findById(leaveId)
                .orElseThrow(() -> new RuntimeException("Leave Request not found"));

        User processor = userRepository.findById(processorId)
                .orElseThrow(() -> new RuntimeException("Processor not found"));
                
        boolean isHR = processor.getRoles().stream()
                               .anyMatch(r -> r.getRole() == RoleName.HR || r.getRole() == RoleName.HR_ADMIN);

        if ("PENDING_MANAGER".equals(leaveRequest.getStatus())) {
            if (leaveRequest.getManagerApprover() != null && leaveRequest.getManagerApprover().getId().equals(processorId)) {
                if ("APPROVE".equalsIgnoreCase(action)) {
                    leaveRequest.setStatus("PENDING_HR");
                } else if ("REJECT".equalsIgnoreCase(action)) {
                    leaveRequest.setStatus("REJECTED");
                }
            } else {
                throw new RuntimeException("You are not the manager for this request.");
            }
        } else if ("PENDING_HR".equals(leaveRequest.getStatus())) {
            if (isHR) {
                if ("APPROVE".equalsIgnoreCase(action)) {
                    leaveRequest.setStatus("APPROVED");
                    leaveRequest.setHrApprover(processor);
                    // Deduct balance
                    if (!"UNPAID".equals(leaveRequest.getLeaveType())) {
                        LeaveBalance balance = leaveBalanceRepository.findByUserIdAndLeaveType(leaveRequest.getApplicant().getId(), leaveRequest.getLeaveType())
                                .orElseThrow(() -> new RuntimeException("Balance not found"));
                        balance.setUsedLeaves(balance.getUsedLeaves() + leaveRequest.getTotalDays());
                        leaveBalanceRepository.save(balance);
                    }
                } else if ("REJECT".equalsIgnoreCase(action)) {
                    leaveRequest.setStatus("REJECTED");
                    leaveRequest.setHrApprover(processor);
                }
            } else {
                throw new RuntimeException("You do not have HR permission to approve this request.");
            }
        } else {
            throw new RuntimeException("Leave request is not in a pending state.");
        }

        return mapToDTO(leaveRequestRepository.save(leaveRequest));
    }
    
    @Transactional
    public TimeOffResponseDTO withdrawLeave(Long applicantId, Long leaveId) {
        LeaveRequest leaveRequest = leaveRequestRepository.findById(leaveId)
                .orElseThrow(() -> new RuntimeException("Leave Request not found"));
                
        if (!leaveRequest.getApplicant().getId().equals(applicantId)) {
            throw new RuntimeException("Not your leave request.");
        }
        
        if ("APPROVED".equals(leaveRequest.getStatus())) {
             throw new RuntimeException("Cannot withdraw already approved leave.");
        }
        
        leaveRequest.setStatus("WITHDRAWN");
        return mapToDTO(leaveRequestRepository.save(leaveRequest));
    }

    private TimeOffResponseDTO mapToDTO(LeaveRequest request) {
        TimeOffResponseDTO dto = new TimeOffResponseDTO();
        dto.setId(request.getId());
        dto.setWorkerId(request.getApplicant().getId().toString());
        dto.setWorkerName(request.getApplicant().getName());
        dto.setTimeOffType(request.getLeaveType());
        dto.setStartDate(request.getStartDate());
        dto.setEndDate(request.getEndDate());
        dto.setTotalQuantity(request.getTotalDays());
        dto.setDailyQuantity(1.0); // Simplified assumption
        dto.setRoutingStatus(request.getStatus());
        return dto;
    }
}
