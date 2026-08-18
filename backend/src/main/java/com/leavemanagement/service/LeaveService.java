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

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class LeaveService {

    private final LeaveRequestRepository leaveRequestRepository;
    private final UserRepository userRepository;
    private final CalendarService calendarService;
    private final LeaveBalanceRepository leaveBalanceRepository;
    private final com.leavemanagement.repository.LeavePolicyRepository leavePolicyRepository;

    public LeaveService(LeaveRequestRepository leaveRequestRepository, UserRepository userRepository,
                        CalendarService calendarService, LeaveBalanceRepository leaveBalanceRepository,
                        com.leavemanagement.repository.LeavePolicyRepository leavePolicyRepository) {
        this.leaveRequestRepository = leaveRequestRepository;
        this.userRepository = userRepository;
        this.calendarService = calendarService;
        this.leaveBalanceRepository = leaveBalanceRepository;
        this.leavePolicyRepository = leavePolicyRepository;
    }

    @Transactional
    public TimeOffResponseDTO applyLeave(Long applicantId, TimeOffRequestDTO requestDTO) {
        User applicant = userRepository.findById(applicantId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        LocalDate reqStart = requestDTO.getStartDate();
        LocalDate reqEnd = requestDTO.getEndDate();

        if (reqStart == null || reqEnd == null || reqStart.isAfter(reqEnd)) {
            throw new RuntimeException("Invalid date range provided.");
        }

        double workingDays = calendarService.calculateWorkingDays(reqStart, reqEnd);
        if (workingDays <= 0) {
            throw new RuntimeException("Selected date range contains no working days (all days are weekends or official holidays).");
        }

        // Rule 1: Cannot apply for leave if already on leave or have active/pending leave on overlapping dates
        List<LeaveRequest> existingLeaves = leaveRequestRepository.findByApplicantId(applicantId).stream()
                .filter(lr -> !"REJECTED".equals(lr.getStatus()) && !"WITHDRAWN".equals(lr.getStatus()))
                .collect(Collectors.toList());

        for (LeaveRequest existing : existingLeaves) {
            boolean isOverlapping = !reqStart.isAfter(existing.getEndDate()) && !reqEnd.isBefore(existing.getStartDate());
            if (isOverlapping) {
                throw new RuntimeException("You already have an active or pending leave from " 
                        + existing.getStartDate() + " to " + existing.getEndDate() 
                        + " (" + existing.getLeaveType() + " - " + existing.getStatus() + "). You cannot apply for overlapping leaves.");
            }

            boolean isAnnualRequested = "ANNUAL".equalsIgnoreCase(requestDTO.getTimeOffType());
            boolean isAnnualExisting = "ANNUAL".equalsIgnoreCase(existing.getLeaveType());

            // Rule 2: Annual leaves must be considered separately and cannot be combined or bridged with other categories
            if ((isAnnualRequested && !isAnnualExisting) || (!isAnnualRequested && isAnnualExisting)) {
                boolean isContiguous = existing.getEndDate().plusDays(1).equals(reqStart) ||
                                       reqEnd.plusDays(1).equals(existing.getStartDate());

                if (isContiguous) {
                    throw new RuntimeException("Annual leaves must be considered separately and cannot be combined or bridged with other categories of leave (e.g., Sick or Casual leave).");
                }
            }
        }

        boolean wantsCompanySponsored = requestDTO.getIsCompanySponsored() == null ? true : requestDTO.getIsCompanySponsored();

        boolean isCompanySponsored = false;
        String payStatus = "UNPAID_LEAVE_OF_ABSENCE";

        if (!"UNPAID".equalsIgnoreCase(requestDTO.getTimeOffType()) && wantsCompanySponsored) {
            LeaveBalance balance = leaveBalanceRepository.findByUserIdAndLeaveType(applicantId, requestDTO.getTimeOffType().toUpperCase())
                    .orElseGet(() -> {
                        double defaultDays = leavePolicyRepository.findByLeaveType(requestDTO.getTimeOffType().toUpperCase())
                                .map(com.leavemanagement.model.LeavePolicy::getDefaultDays)
                                .orElse(10.0);
                        return leaveBalanceRepository.save(new LeaveBalance(null, applicant, requestDTO.getTimeOffType().toUpperCase(), defaultDays, 0.0));
                    });
            
            double remaining = balance.getTotalLeaves() - balance.getUsedLeaves();
            if (remaining < workingDays) {
                throw new RuntimeException("Insufficient paid leave balance (" + remaining + " days left). Please choose non-company sponsored (Unpaid Leave of Absence) if you wish to apply without quota.");
            }

            // Company sponsored: eligible paid leave where salary is credited
            isCompanySponsored = true;
            payStatus = "COMPANY_SPONSORED";
        } else {
            // Non-company sponsored or unpaid: no balance required/deducted, no salary credited
            isCompanySponsored = false;
            payStatus = "UNPAID_LEAVE_OF_ABSENCE";
        }

        LeaveRequest request = new LeaveRequest();
        request.setApplicant(applicant);
        request.setStartDate(reqStart);
        request.setEndDate(reqEnd);
        request.setLeaveType(requestDTO.getTimeOffType().toUpperCase());
        request.setReason(requestDTO.getReason());
        request.setTotalDays(workingDays);
        request.setIsCompanySponsored(isCompanySponsored);
        request.setPayStatus(payStatus);

        boolean isApplicantHR = applicant.getRoles().stream()
                .anyMatch(r -> r.getRole() == RoleName.HR && r.getRole() != RoleName.HR_ADMIN);
        boolean isApplicantAdmin = applicant.getRoles().stream()
                .anyMatch(r -> r.getRole() == RoleName.HR_ADMIN);

        if (applicant.getManager() != null) {
            request.setManagerApprover(applicant.getManager());
            request.setStatus("PENDING_MANAGER");
        } else {
            // No manager assigned: if HR, routes to Admin; otherwise routes to HR
            if (isApplicantHR) {
                request.setStatus("PENDING_ADMIN");
            } else if (isApplicantAdmin) {
                request.setStatus("PENDING_ADMIN");
            } else {
                request.setStatus("PENDING_HR");
            }
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

    public List<TimeOffResponseDTO> getLeavesToApproveByHR(Long hrUserId) {
        return leaveRequestRepository.findByStatus("PENDING_HR")
                .stream()
                .filter(req -> !req.getApplicant().getId().equals(hrUserId))
                .map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<TimeOffResponseDTO> getLeavesToApproveByAdmin(Long adminUserId) {
        return leaveRequestRepository.findByStatus("PENDING_ADMIN")
                .stream()
                .filter(req -> !req.getApplicant().getId().equals(adminUserId))
                .map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<TimeOffResponseDTO> getAllLeavesHistory() {
        return leaveRequestRepository.findAll()
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<TimeOffResponseDTO> getDirectReporteesLeavesHistory(Long managerId) {
        return leaveRequestRepository.findByApplicantManagerId(managerId)
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<TimeOffResponseDTO> getTeamLeavesHistory(Long managerId) {
        return leaveRequestRepository.findByApplicantManagerId(managerId)
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<TimeOffResponseDTO> getUserLeavesHistory(Long userId) {
        return leaveRequestRepository.findByApplicantId(userId)
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<com.leavemanagement.payload.UserSummaryDTO> getDirectReportees(Long managerId) {
        return userRepository.findByManagerId(managerId).stream().map(u -> {
            List<String> roleNames = u.getRoles().stream()
                    .map(r -> r.getRole().name())
                    .collect(Collectors.toList());
            String mgr = u.getManager() != null ? u.getManager().getName() : "None";
            return new com.leavemanagement.payload.UserSummaryDTO(u.getId(), u.getName(), u.getEmail(), roleNames, mgr);
        }).collect(Collectors.toList());
    }

    public List<com.leavemanagement.payload.UserSummaryDTO> getAllEmployeesSummary() {
        return userRepository.findAll().stream().map(u -> {
            List<String> roleNames = u.getRoles().stream()
                    .map(r -> r.getRole().name())
                    .collect(Collectors.toList());
            String mgr = u.getManager() != null ? u.getManager().getName() : "None";
            return new com.leavemanagement.payload.UserSummaryDTO(u.getId(), u.getName(), u.getEmail(), roleNames, mgr);
        }).collect(Collectors.toList());
    }

    @Transactional
    public TimeOffResponseDTO processLeaveRequest(Long processorId, Long leaveId, String action) {
        LeaveRequest leaveRequest = leaveRequestRepository.findById(leaveId)
                .orElseThrow(() -> new RuntimeException("Leave Request not found"));

        User processor = userRepository.findById(processorId)
                .orElseThrow(() -> new RuntimeException("Processor not found"));
                
        boolean isHR = processor.getRoles().stream()
                               .anyMatch(r -> r.getRole() == RoleName.HR || r.getRole() == RoleName.HR_ADMIN);
        boolean isAdmin = processor.getRoles().stream()
                               .anyMatch(r -> r.getRole() == RoleName.HR_ADMIN);

        if ("PENDING_MANAGER".equals(leaveRequest.getStatus())) {
            if (leaveRequest.getManagerApprover() != null && leaveRequest.getManagerApprover().getId().equals(processorId)) {
                if ("APPROVE".equalsIgnoreCase(action)) {
                    // Check: Is the applicant an HR member?
                    boolean isApplicantHR = leaveRequest.getApplicant().getRoles().stream()
                            .anyMatch(r -> r.getRole() == RoleName.HR);

                    if (isApplicantHR) {
                        // If HR requests leave, after manager approval it goes to ADMIN
                        leaveRequest.setStatus("PENDING_ADMIN");
                    } else {
                        // Standard employees & managers move to HR (never to admin)
                        leaveRequest.setStatus("PENDING_HR");
                    }
                } else if ("REJECT".equalsIgnoreCase(action)) {
                    leaveRequest.setStatus("REJECTED");
                }
            } else {
                throw new RuntimeException("You are not the designated manager for this request.");
            }
        } else if ("PENDING_HR".equals(leaveRequest.getStatus())) {
            if (leaveRequest.getApplicant().getId().equals(processorId)) {
                throw new RuntimeException("You cannot approve your own leave request.");
            }
            if (isHR) {
                if ("APPROVE".equalsIgnoreCase(action)) {
                    leaveRequest.setStatus("APPROVED");
                    leaveRequest.setHrApprover(processor);
                    // Deduct balance if company-sponsored
                    if (Boolean.TRUE.equals(leaveRequest.getIsCompanySponsored()) && !"UNPAID".equalsIgnoreCase(leaveRequest.getLeaveType())) {
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
        } else if ("PENDING_ADMIN".equals(leaveRequest.getStatus())) {
            if (isAdmin) {
                if ("APPROVE".equalsIgnoreCase(action)) {
                    leaveRequest.setStatus("APPROVED");
                    leaveRequest.setHrApprover(processor);
                    // Deduct balance if company-sponsored
                    if (Boolean.TRUE.equals(leaveRequest.getIsCompanySponsored()) && !"UNPAID".equalsIgnoreCase(leaveRequest.getLeaveType())) {
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
                throw new RuntimeException("Only an HR Admin can approve leave requests submitted by HR personnel.");
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
        
        if ("WITHDRAWN".equals(leaveRequest.getStatus()) || "REJECTED".equals(leaveRequest.getStatus())) {
            throw new RuntimeException("Request is already " + leaveRequest.getStatus().toLowerCase() + ".");
        }
        
        if ("APPROVED".equals(leaveRequest.getStatus())) {
            if (leaveRequest.getEndDate().isBefore(LocalDate.now())) {
                throw new RuntimeException("Cannot withdraw past completed leave.");
            }
            // Refund balance if company sponsored
            if (Boolean.TRUE.equals(leaveRequest.getIsCompanySponsored()) && !"UNPAID".equalsIgnoreCase(leaveRequest.getLeaveType())) {
                leaveBalanceRepository.findByUserIdAndLeaveType(applicantId, leaveRequest.getLeaveType())
                        .ifPresent(balance -> {
                            balance.setUsedLeaves(Math.max(0.0, balance.getUsedLeaves() - leaveRequest.getTotalDays()));
                            leaveBalanceRepository.save(balance);
                        });
            }
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

        boolean isSponsored = Boolean.TRUE.equals(request.getIsCompanySponsored());
        dto.setIsCompanySponsored(isSponsored);
        dto.setPayStatus(request.getPayStatus() != null ? request.getPayStatus() : (isSponsored ? "COMPANY_SPONSORED" : "UNPAID_LEAVE_OF_ABSENCE"));
        dto.setSalaryCredited(isSponsored);
        dto.setPayStatusLabel(isSponsored ? "Company Sponsored (Salary Credited)" : "Unpaid Leave of Absence (No Salary)");

        return dto;
    }

    public double calculateProratedQuota(com.leavemanagement.model.LeavePolicy policy, LocalDate joinDate, LocalDate periodStart, LocalDate periodEnd) {
        if (policy == null || policy.getDefaultDays() == null) return 0.0;
        double fullQuota = policy.getDefaultDays();
        if (policy.getIsProrated() == null || !policy.getIsProrated()) {
            return fullQuota;
        }

        LocalDate start = periodStart != null ? periodStart : (policy.getEffectiveDate() != null ? policy.getEffectiveDate() : LocalDate.of(LocalDate.now().getYear(), 1, 1));
        LocalDate end = periodEnd != null ? periodEnd : (policy.getEndDate() != null ? policy.getEndDate() : start.plusYears(1).minusDays(1));

        LocalDate effectiveJoin = (joinDate != null && joinDate.isAfter(start)) ? joinDate : start;
        if (effectiveJoin.isAfter(end)) return 0.0;

        long totalDaysInPeriod = java.time.temporal.ChronoUnit.DAYS.between(start, end) + 1;
        long remainingDays = java.time.temporal.ChronoUnit.DAYS.between(effectiveJoin, end) + 1;

        if (totalDaysInPeriod <= 0) return fullQuota;

        double rawProrated = fullQuota * ((double) remainingDays / (double) totalDaysInPeriod);

        String rounding = policy.getProrationRounding() != null ? policy.getProrationRounding() : "ROUND_HALF";
        switch (rounding) {
            case "ROUND_UP":
                return Math.ceil(rawProrated);
            case "ROUND_DOWN":
                return Math.floor(rawProrated);
            case "ROUND_HALF":
                return Math.round(rawProrated * 2.0) / 2.0;
            case "EXACT":
            default:
                return Math.round(rawProrated * 100.0) / 100.0;
        }
    }
}
