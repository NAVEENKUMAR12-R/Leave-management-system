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
    private final SseEmitterService sseEmitterService;

    public LeaveService(LeaveRequestRepository leaveRequestRepository, UserRepository userRepository,
            CalendarService calendarService, LeaveBalanceRepository leaveBalanceRepository,
            com.leavemanagement.repository.LeavePolicyRepository leavePolicyRepository,
            SseEmitterService sseEmitterService) {
        this.leaveRequestRepository = leaveRequestRepository;
        this.userRepository = userRepository;
        this.calendarService = calendarService;
        this.leaveBalanceRepository = leaveBalanceRepository;
        this.leavePolicyRepository = leavePolicyRepository;
        this.sseEmitterService = sseEmitterService;
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
            throw new RuntimeException(
                    "Selected date range contains no working days (all days are weekends or official holidays).");
        }

        // Rule 1: Cannot apply for leave if already on leave or have active/pending
        // leave on overlapping dates
        List<LeaveRequest> existingLeaves = leaveRequestRepository.findByApplicantId(applicantId).stream()
                .filter(lr -> !"REJECTED".equals(lr.getStatus()) && !"WITHDRAWN".equals(lr.getStatus()))
                .collect(Collectors.toList());

        for (LeaveRequest existing : existingLeaves) {
            boolean isOverlapping = !reqStart.isAfter(existing.getEndDate())
                    && !reqEnd.isBefore(existing.getStartDate());
            if (isOverlapping) {
                throw new RuntimeException("You already have an active or pending leave from "
                        + existing.getStartDate() + " to " + existing.getEndDate()
                        + " (" + existing.getLeaveType() + " - " + existing.getStatus()
                        + "). You cannot apply for overlapping leaves.");
            }

            boolean isAnnualRequested = "ANNUAL".equalsIgnoreCase(requestDTO.getTimeOffType());
            boolean isAnnualExisting = "ANNUAL".equalsIgnoreCase(existing.getLeaveType());

            // Rule 2: Annual leaves must be considered separately and cannot be combined or
            // bridged with other categories
            if ((isAnnualRequested && !isAnnualExisting) || (!isAnnualRequested && isAnnualExisting)) {
                boolean isContiguous = existing.getEndDate().plusDays(1).equals(reqStart) ||
                        reqEnd.plusDays(1).equals(existing.getStartDate());

                if (isContiguous) {
                    throw new RuntimeException(
                            "Annual leaves must be considered separately and cannot be combined or bridged with other categories of leave (e.g., Sick or Casual leave).");
                }
            }
        }

        boolean wantsCompanySponsored = requestDTO.getIsCompanySponsored() == null ? true
                : requestDTO.getIsCompanySponsored();

        boolean isCompanySponsored = false;
        String payStatus = "UNPAID_LEAVE_OF_ABSENCE";

        if (!"UNPAID".equalsIgnoreCase(requestDTO.getTimeOffType())) {
            String leaveType = requestDTO.getTimeOffType().toUpperCase();

            com.leavemanagement.model.LeavePolicy policy = leavePolicyRepository
                    .findByLeaveType(leaveType)
                    .orElseThrow(() -> new RuntimeException("No active policy found for " + leaveType + " leave. You are not eligible to request this category."));

            if (policy.getIsActive() != null && (!policy.getIsActive() || "ARCHIVED".equalsIgnoreCase(policy.getPolicyStatus()))) {
                throw new RuntimeException("The " + leaveType + " policy is currently archived or inactive. You cannot apply for this category.");
            }

            // Check role eligibility
            java.util.Set<String> userRoleNames = applicant.getRoles().stream()
                    .map(r -> r.getRole().name())
                    .collect(java.util.stream.Collectors.toSet());

            if (!isPolicyApplicableToUserRoles(policy.getEligibleRole(), userRoleNames)) {
                throw new RuntimeException("You are not eligible for " + leaveType + " leave. This policy is restricted to: " + policy.getEligibleRole() + ".");
            }
        }

        if (!"UNPAID".equalsIgnoreCase(requestDTO.getTimeOffType()) && wantsCompanySponsored) {
            LeaveBalance balance = leaveBalanceRepository
                    .findByUserIdAndLeaveType(applicantId, requestDTO.getTimeOffType().toUpperCase())
                    .orElseGet(() -> {
                        double defaultDays = leavePolicyRepository
                                .findByLeaveType(requestDTO.getTimeOffType().toUpperCase())
                                .map(com.leavemanagement.model.LeavePolicy::getDefaultDays)
                                .orElse(10.0);
                        return leaveBalanceRepository.save(new LeaveBalance(null, applicant,
                                requestDTO.getTimeOffType().toUpperCase(), defaultDays, 0.0));
                    });

            com.leavemanagement.model.LeavePolicy policy = leavePolicyRepository
                    .findByLeaveType(requestDTO.getTimeOffType().toUpperCase())
                    .orElse(null);

            int currentMonth = java.time.LocalDate.now().getMonthValue();
            String frequency = policy != null && policy.getAccrualFrequency() != null
                    ? policy.getAccrualFrequency()
                    : ("CASUAL".equalsIgnoreCase(requestDTO.getTimeOffType()) ? "ANNUAL" : "MONTHLY");

            Double rate = policy != null && policy.getAccrualRate() != null
                    ? policy.getAccrualRate()
                    : (balance.getTotalLeaves() != null ? Math.round((balance.getTotalLeaves() / 12.0) * 100.0) / 100.0 : 1.0);

            double totalAnnual = balance.getTotalLeaves() != null ? balance.getTotalLeaves() : 0.0;
            double accrued = "MONTHLY".equalsIgnoreCase(frequency)
                    ? Math.min(totalAnnual, Math.round(currentMonth * rate * 100.0) / 100.0)
                    : totalAnnual;

            double used = balance.getUsedLeaves() != null ? balance.getUsedLeaves() : 0.0;
            double remaining = Math.round((accrued - used) * 100.0) / 100.0;

            if (remaining < workingDays) {
                boolean allowNegative = policy != null && Boolean.TRUE.equals(policy.getAllowNegativeBalance());
                double maxNeg = policy != null && policy.getMaxNegativeLimit() != null ? policy.getMaxNegativeLimit() : 0.0;

                if (allowNegative && ((remaining + maxNeg) >= workingDays)) {
                    // Allowed advance borrow
                } else {
                    throw new RuntimeException("Insufficient accrued leave balance (" + Math.max(0.0, remaining)
                            + " days available). In " + java.time.LocalDate.now().getMonth().name()
                            + " you have accrued " + accrued + " days of your " + totalAnnual
                            + " annual quota. You can apply up to " + Math.max(0.0, remaining)
                            + " days as paid leave and the remaining " + Math.round((workingDays - remaining) * 100.0) / 100.0
                            + " days as Unpaid Leave (Loss of Pay).");
                }
            }

            // Company sponsored: eligible paid leave where salary is credited
            isCompanySponsored = true;
            payStatus = "COMPANY_SPONSORED";
        } else {
            // Non-company sponsored or unpaid: no balance required/deducted, no salary
            // credited
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
        TimeOffResponseDTO dto = mapToDTO(saved);
        sseEmitterService.broadcast("LEAVE_UPDATE", dto);
        return dto;
    }

    public List<TimeOffResponseDTO> getMyLeaves(Long applicantId) {
        return leaveRequestRepository.findByApplicantId(applicantId)
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<TimeOffResponseDTO> getLeavesToApproveByManager(Long managerId) {
        return leaveRequestRepository.findPendingLeavesToApproveByManager(managerId)
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<TimeOffResponseDTO> getLeavesToApproveByHR(Long hrId) {
        return leaveRequestRepository.findPendingLeavesToApproveByHR(hrId)
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<TimeOffResponseDTO> getLeavesToApproveByAdmin(Long adminId) {
        return leaveRequestRepository.findPendingLeavesToApproveByAdmin(adminId)
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<TimeOffResponseDTO> getPendingApprovalsForUser(Long userId, boolean isAdmin, boolean isHR, boolean isManager) {
        java.util.LinkedHashSet<com.leavemanagement.model.LeaveRequest> pendingSet = new java.util.LinkedHashSet<>();
        if (isManager) {
            pendingSet.addAll(leaveRequestRepository.findPendingLeavesToApproveByManager(userId));
        }
        if (isHR) {
            pendingSet.addAll(leaveRequestRepository.findPendingLeavesToApproveByHR(userId));
        }
        if (isAdmin) {
            pendingSet.addAll(leaveRequestRepository.findPendingLeavesToApproveByAdmin(userId));
        }
        return pendingSet.stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<TimeOffResponseDTO> getDirectReporteesLeavesHistory(Long managerId) {
        return leaveRequestRepository.findByApplicantManagerId(managerId)
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<TimeOffResponseDTO> getTeamLeavesHistory(Long managerId) {
        return leaveRequestRepository.findByApplicantManagerId(managerId)
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<TimeOffResponseDTO> getAllLeavesHistory() {
        return leaveRequestRepository.findAll()
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<TimeOffResponseDTO> getUserLeavesHistory(Long userId) {
        return leaveRequestRepository.findByApplicantId(userId)
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<com.leavemanagement.payload.UserSummaryDTO> getDirectReportees(Long managerId) {
        return userRepository.findByManagerId(managerId).stream()
                .map(u -> new com.leavemanagement.payload.UserSummaryDTO(u.getId(), u.getName(), u.getEmail()))
                .collect(Collectors.toList());
    }

    public List<com.leavemanagement.payload.UserSummaryDTO> getAllEmployeesSummary() {
        return userRepository.findAll().stream()
                .map(u -> new com.leavemanagement.payload.UserSummaryDTO(u.getId(), u.getName(), u.getEmail()))
                .collect(Collectors.toList());
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

        boolean isDesignatedManager = leaveRequest.getManagerApprover() != null
                && leaveRequest.getManagerApprover().getId().equals(processorId);

        if ("PENDING_MANAGER".equals(leaveRequest.getStatus())) {
            if (isDesignatedManager || isAdmin) {
                if ("APPROVE".equalsIgnoreCase(action)) {
                    // Check: Is the applicant an HR member?
                    boolean isApplicantHR = leaveRequest.getApplicant().getRoles().stream()
                            .anyMatch(r -> r.getRole() == RoleName.HR && r.getRole() != RoleName.HR_ADMIN);

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
            if (isHR || isAdmin) {
                if ("APPROVE".equalsIgnoreCase(action)) {
                    leaveRequest.setStatus("APPROVED");
                    leaveRequest.setHrApprover(processor);
                    // Deduct balance if company-sponsored
                    if (Boolean.TRUE.equals(leaveRequest.getIsCompanySponsored())
                            && !"UNPAID".equalsIgnoreCase(leaveRequest.getLeaveType())) {
                        LeaveBalance balance = leaveBalanceRepository
                                .findByUserIdAndLeaveType(leaveRequest.getApplicant().getId(),
                                        leaveRequest.getLeaveType())
                                .orElseGet(() -> {
                                    double defaultDays = leavePolicyRepository
                                            .findByLeaveType(leaveRequest.getLeaveType())
                                            .map(com.leavemanagement.model.LeavePolicy::getDefaultDays)
                                            .orElse(10.0);
                                    return leaveBalanceRepository.save(new LeaveBalance(null, leaveRequest.getApplicant(),
                                            leaveRequest.getLeaveType(), defaultDays, 0.0));
                                });
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
                    if (Boolean.TRUE.equals(leaveRequest.getIsCompanySponsored())
                            && !"UNPAID".equalsIgnoreCase(leaveRequest.getLeaveType())) {
                        LeaveBalance balance = leaveBalanceRepository
                                .findByUserIdAndLeaveType(leaveRequest.getApplicant().getId(),
                                        leaveRequest.getLeaveType())
                                .orElseGet(() -> {
                                    double defaultDays = leavePolicyRepository
                                            .findByLeaveType(leaveRequest.getLeaveType())
                                            .map(com.leavemanagement.model.LeavePolicy::getDefaultDays)
                                            .orElse(10.0);
                                    return leaveBalanceRepository.save(new LeaveBalance(null, leaveRequest.getApplicant(),
                                            leaveRequest.getLeaveType(), defaultDays, 0.0));
                                });
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
            throw new RuntimeException("Leave request is not in a pending state (Current status: " + leaveRequest.getStatus() + ").");
        }

        TimeOffResponseDTO dto = mapToDTO(leaveRequestRepository.save(leaveRequest));
        sseEmitterService.broadcast("LEAVE_UPDATE", dto);
        return dto;
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
            if (Boolean.TRUE.equals(leaveRequest.getIsCompanySponsored())
                    && !"UNPAID".equalsIgnoreCase(leaveRequest.getLeaveType())) {
                leaveBalanceRepository.findByUserIdAndLeaveType(applicantId, leaveRequest.getLeaveType())
                        .ifPresent(balance -> {
                            balance.setUsedLeaves(Math.max(0.0, balance.getUsedLeaves() - leaveRequest.getTotalDays()));
                            leaveBalanceRepository.save(balance);
                        });
            }
        }

        leaveRequest.setStatus("WITHDRAWN");
        TimeOffResponseDTO dto = mapToDTO(leaveRequestRepository.save(leaveRequest));
        sseEmitterService.broadcast("LEAVE_UPDATE", dto);
        return dto;
    }

    @Transactional
    public TimeOffResponseDTO extendLeave(Long applicantId, Long leaveId, LocalDate newEndDate, String reason) {
        LeaveRequest leaveRequest = leaveRequestRepository.findById(leaveId)
                .orElseThrow(() -> new RuntimeException("Leave Request not found"));

        if (!leaveRequest.getApplicant().getId().equals(applicantId)) {
            throw new RuntimeException("You can only extend your own leave requests.");
        }

        if (!"APPROVED".equals(leaveRequest.getStatus()) && !"PENDING_MANAGER".equals(leaveRequest.getStatus()) && !"PENDING_HR".equals(leaveRequest.getStatus())) {
            throw new RuntimeException("Only approved or pending leaves can be extended.");
        }

        if (newEndDate == null || !newEndDate.isAfter(leaveRequest.getEndDate())) {
            throw new RuntimeException("New end date must be after the current end date (" + leaveRequest.getEndDate() + ").");
        }

        LocalDate oldEndDate = leaveRequest.getEndDate();
        LocalDate extensionStart = oldEndDate.plusDays(1);
        double additionalWorkingDays = calendarService.calculateWorkingDays(extensionStart, newEndDate);

        if (additionalWorkingDays <= 0) {
            throw new RuntimeException("The selected extension period contains 0 working days.");
        }

        // Check overlapping leaves for the extension period
        List<LeaveRequest> existingLeaves = leaveRequestRepository.findByApplicantId(applicantId).stream()
                .filter(lr -> !lr.getId().equals(leaveId) && !"REJECTED".equals(lr.getStatus()) && !"WITHDRAWN".equals(lr.getStatus()))
                .collect(Collectors.toList());

        for (LeaveRequest existing : existingLeaves) {
            boolean isOverlapping = !extensionStart.isAfter(existing.getEndDate())
                    && !newEndDate.isBefore(existing.getStartDate());
            if (isOverlapping) {
                throw new RuntimeException("The extension period from " + extensionStart + " to " + newEndDate
                        + " overlaps with another leave (" + existing.getStartDate() + " to " + existing.getEndDate() + ").");
            }
        }

        // Check balance for additional days if company-sponsored
        if (Boolean.TRUE.equals(leaveRequest.getIsCompanySponsored()) && !"UNPAID".equalsIgnoreCase(leaveRequest.getLeaveType())) {
            LeaveBalance balance = leaveBalanceRepository
                    .findByUserIdAndLeaveType(applicantId, leaveRequest.getLeaveType())
                    .orElseThrow(() -> new RuntimeException("Balance record not found"));

            com.leavemanagement.model.LeavePolicy policy = leavePolicyRepository
                    .findByLeaveType(leaveRequest.getLeaveType())
                    .orElse(null);

            int currentMonth = LocalDate.now().getMonthValue();
            String frequency = policy != null && policy.getAccrualFrequency() != null
                    ? policy.getAccrualFrequency()
                    : ("CASUAL".equalsIgnoreCase(leaveRequest.getLeaveType()) ? "ANNUAL" : "MONTHLY");

            Double rate = policy != null && policy.getAccrualRate() != null
                    ? policy.getAccrualRate()
                    : (balance.getTotalLeaves() != null ? Math.round((balance.getTotalLeaves() / 12.0) * 100.0) / 100.0 : 1.0);

            double totalAnnual = balance.getTotalLeaves() != null ? balance.getTotalLeaves() : 0.0;
            double accrued = "MONTHLY".equalsIgnoreCase(frequency)
                    ? Math.min(totalAnnual, Math.round(currentMonth * rate * 100.0) / 100.0)
                    : totalAnnual;

            double used = balance.getUsedLeaves() != null ? balance.getUsedLeaves() : 0.0;
            double remaining = Math.round((accrued - used) * 100.0) / 100.0;

            if (remaining < additionalWorkingDays) {
                boolean allowNegative = policy != null && Boolean.TRUE.equals(policy.getAllowNegativeBalance());
                double maxNeg = policy != null && policy.getMaxNegativeLimit() != null ? policy.getMaxNegativeLimit() : 0.0;

                if (allowNegative && ((remaining + maxNeg) >= additionalWorkingDays)) {
                    // Allowed advance borrow
                } else {
                    throw new RuntimeException("Insufficient accrued balance for " + additionalWorkingDays + " additional days (" + Math.max(0.0, remaining) + " days available).");
                }
            }
        }

        // Update leave request dates
        leaveRequest.setEndDate(newEndDate);
        leaveRequest.setTotalDays(leaveRequest.getTotalDays() + additionalWorkingDays);
        if (reason != null && !reason.trim().isEmpty()) {
            leaveRequest.setReason((leaveRequest.getReason() != null ? leaveRequest.getReason() + " | " : "") + "[Extended to " + newEndDate + ": " + reason.trim() + "]");
        }

        // Route through Manager/HR extension approval
        User applicant = leaveRequest.getApplicant();
        boolean isApplicantHR = applicant.getRoles().stream()
                .anyMatch(r -> r.getRole() == RoleName.HR && r.getRole() != RoleName.HR_ADMIN);

        if (applicant.getManager() != null) {
            leaveRequest.setStatus("PENDING_MANAGER");
        } else if (isApplicantHR) {
            leaveRequest.setStatus("PENDING_ADMIN");
        } else {
            leaveRequest.setStatus("PENDING_HR");
        }

        LeaveRequest saved = leaveRequestRepository.save(leaveRequest);
        TimeOffResponseDTO dto = mapToDTO(saved);
        sseEmitterService.broadcast("LEAVE_UPDATE", dto);
        return dto;
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
        dto.setPayStatus(request.getPayStatus() != null ? request.getPayStatus()
                : (isSponsored ? "COMPANY_SPONSORED" : "UNPAID_LEAVE_OF_ABSENCE"));
        dto.setSalaryCredited(isSponsored);
        dto.setPayStatusLabel(
                isSponsored ? "Company Sponsored (Salary Credited)" : "Unpaid Leave (No Salary)");
        dto.setReason(request.getReason());

        return dto;
    }

    public double calculateProratedQuota(com.leavemanagement.model.LeavePolicy policy, LocalDate joinDate,
            LocalDate periodStart, LocalDate periodEnd) {
        if (policy == null || policy.getDefaultDays() == null)
            return 0.0;
        double fullQuota = policy.getDefaultDays();
        if (policy.getIsProrated() == null || !policy.getIsProrated()) {
            return fullQuota;
        }

        LocalDate start = periodStart != null ? periodStart
                : (policy.getEffectiveDate() != null ? policy.getEffectiveDate()
                        : LocalDate.of(LocalDate.now().getYear(), 1, 1));
        LocalDate end = periodEnd != null ? periodEnd
                : (policy.getEndDate() != null ? policy.getEndDate() : start.plusYears(1).minusDays(1));

        LocalDate effectiveJoin = (joinDate != null && joinDate.isAfter(start)) ? joinDate : start;
        if (effectiveJoin.isAfter(end))
            return 0.0;

        long totalDaysInPeriod = java.time.temporal.ChronoUnit.DAYS.between(start, end) + 1;
        long remainingDays = java.time.temporal.ChronoUnit.DAYS.between(effectiveJoin, end) + 1;

        if (totalDaysInPeriod <= 0)
            return fullQuota;

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

    private boolean isPolicyApplicableToUserRoles(String eligibleRole, java.util.Set<String> userRoles) {
        if (eligibleRole == null || eligibleRole.trim().isEmpty() || "ALL".equalsIgnoreCase(eligibleRole.trim())) {
            return true;
        }
        String primaryRole = "EMPLOYEE";
        if (userRoles.contains("ROLE_HR_ADMIN") || userRoles.contains("HR_ADMIN")) primaryRole = "HR_ADMIN";
        else if (userRoles.contains("ROLE_HR") || userRoles.contains("HR")) primaryRole = "HR";
        else if (userRoles.contains("ROLE_MANAGER") || userRoles.contains("MANAGER")) primaryRole = "MANAGER";

        String target = eligibleRole.trim().toUpperCase();
        switch (target) {
            case "EXECUTIVE":
            case "HR_ADMIN":
                return "HR_ADMIN".equals(primaryRole);
            case "HR":
                return "HR".equals(primaryRole) || "HR_ADMIN".equals(primaryRole);
            case "MANAGER":
                return "MANAGER".equals(primaryRole) || "HR".equals(primaryRole) || "HR_ADMIN".equals(primaryRole);
            case "EMPLOYEE":
                return true;
            default:
                return true;
        }
    }
}
