package com.leavemanagement.service;

import com.leavemanagement.model.LeaveBalance;
import com.leavemanagement.model.LeavePolicy;
import com.leavemanagement.model.LeaveRequest;
import com.leavemanagement.model.RoleName;
import com.leavemanagement.model.User;
import com.leavemanagement.payload.TimeOffRequestDTO;
import com.leavemanagement.payload.TimeOffResponseDTO;
import com.leavemanagement.repository.LeaveBalanceRepository;
import com.leavemanagement.repository.LeaveRequestRepository;
import com.leavemanagement.repository.LeavePolicyRepository;
import com.leavemanagement.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class LeaveService {

    private final LeaveRequestRepository leaveRequestRepository;
    private final UserRepository userRepository;
    private final CalendarService calendarService;
    private final LeaveBalanceRepository leaveBalanceRepository;
    private final LeavePolicyRepository leavePolicyRepository;
    private final SseEmitterService sseEmitterService;

    public LeaveService(LeaveRequestRepository leaveRequestRepository, UserRepository userRepository,
            CalendarService calendarService, LeaveBalanceRepository leaveBalanceRepository,
            LeavePolicyRepository leavePolicyRepository,
            SseEmitterService sseEmitterService) {
        this.leaveRequestRepository = leaveRequestRepository;
        this.userRepository = userRepository;
        this.calendarService = calendarService;
        this.leaveBalanceRepository = leaveBalanceRepository;
        this.leavePolicyRepository = leavePolicyRepository;
        this.sseEmitterService = sseEmitterService;
    }

    // =========================================================================
    // POLICY RESOLUTION — Find the best matching active policy for a user
    // =========================================================================

    /**
     * Finds the most specific active, non-archived policy for the given leaveType
     * that is applicable to the given user (role, region, employee type, department, tenure).
     * Returns null if no matching policy exists.
     */
    public LeavePolicy findBestMatchingPolicy(String leaveType, User user) {
        if (leaveType == null || user == null) return null;

        List<LeavePolicy> candidates = leavePolicyRepository.findAllByLeaveType(leaveType.toUpperCase());

        List<LeavePolicy> active = candidates.stream()
                .filter(p -> p.getIsActive() == null || (p.getIsActive() && !"ARCHIVED".equalsIgnoreCase(p.getPolicyStatus())))
                .filter(p -> isPolicyApplicableToUser(p, user))
                .collect(Collectors.toList());

        if (active.isEmpty()) return null;
        if (active.size() == 1) return active.get(0);

        // If multiple policies match, prefer the most specific one (most non-ALL fields)
        return active.stream()
                .max((a, b) -> Integer.compare(specificityScore(a), specificityScore(b)))
                .orElse(active.get(0));
    }

    private int specificityScore(LeavePolicy p) {
        int score = 0;
        if (p.getRegion() != null && !"Global".equalsIgnoreCase(p.getRegion()) && !"ALL".equalsIgnoreCase(p.getRegion())) score++;
        if (p.getEmployeeType() != null && !"ALL".equalsIgnoreCase(p.getEmployeeType())) score++;
        if (p.getDepartment() != null && !"All Departments".equalsIgnoreCase(p.getDepartment()) && !"ALL".equalsIgnoreCase(p.getDepartment())) score++;
        if (p.getEligibleRole() != null && !"ALL".equalsIgnoreCase(p.getEligibleRole())) score++;
        if (p.getTenureMonths() != null && p.getTenureMonths() > 0) score++;
        if (p.getGradeLevel() != null && !"All Grades".equalsIgnoreCase(p.getGradeLevel()) && !"ALL".equalsIgnoreCase(p.getGradeLevel())) score++;
        return score;
    }

    // =========================================================================
    // APPLY LEAVE — Full policy enforcement
    // =========================================================================

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

        String leaveType = requestDTO.getTimeOffType().toUpperCase();
        boolean isUnpaid = "UNPAID".equalsIgnoreCase(leaveType);

        // Resolve the best matching policy for this user + leave type
        LeavePolicy policy = isUnpaid ? null : findBestMatchingPolicy(leaveType, applicant);

        if (!isUnpaid && policy == null) {
            throw new RuntimeException("No active policy found for " + leaveType + " leave. You are not eligible to request this category.");
        }

        // ---- Policy Period Validation ----
        if (policy != null) {
            if (policy.getEffectiveDate() != null && reqStart.isBefore(policy.getEffectiveDate())) {
                throw new RuntimeException("Leave start date (" + reqStart + ") is before the policy effective date (" + policy.getEffectiveDate() + ").");
            }
            if (policy.getEndDate() != null && reqEnd.isAfter(policy.getEndDate())) {
                throw new RuntimeException("Leave end date (" + reqEnd + ") is after the policy expiry date (" + policy.getEndDate() + "). Please adjust your dates.");
            }
        }

        // ---- Tenure Eligibility ----
        if (policy != null && policy.getTenureMonths() != null && policy.getTenureMonths() > 0 && applicant.getHireDate() != null) {
            long tenureMonths = ChronoUnit.MONTHS.between(applicant.getHireDate(), LocalDate.now());
            if (tenureMonths < policy.getTenureMonths()) {
                throw new RuntimeException("You need at least " + policy.getTenureMonths() + " months of tenure to apply for " + leaveType
                        + " leave. Your current tenure is " + tenureMonths + " months.");
            }
        }

        // ---- Overlap Prevention (policy-driven) ----
        List<LeaveRequest> existingLeaves = leaveRequestRepository.findByApplicantId(applicantId).stream()
                .filter(lr -> !"REJECTED".equals(lr.getStatus()) && !"WITHDRAWN".equals(lr.getStatus()))
                .collect(Collectors.toList());

        Set<String> overlapCategories = resolveOverlapCategories(policy);

        for (LeaveRequest existing : existingLeaves) {
            boolean isOverlapping = !reqStart.isAfter(existing.getEndDate())
                    && !reqEnd.isBefore(existing.getStartDate());

            if (isOverlapping) {
                // Always prevent same-type overlap
                if (existing.getLeaveType().equalsIgnoreCase(leaveType)) {
                    throw new RuntimeException("You already have an active or pending " + leaveType + " leave from "
                            + existing.getStartDate() + " to " + existing.getEndDate()
                            + ". You cannot apply for overlapping leaves.");
                }
                // Check cross-category overlap per policy configuration
                if (overlapCategories.contains("ALL") || overlapCategories.contains(existing.getLeaveType().toUpperCase())) {
                    throw new RuntimeException("You already have an active or pending leave from "
                            + existing.getStartDate() + " to " + existing.getEndDate()
                            + " (" + existing.getLeaveType() + " - " + existing.getStatus()
                            + "). Overlap with " + leaveType + " is prevented by policy.");
                }
            }

            // Contiguity rule: Annual leaves cannot be bridged with other categories
            boolean isAnnualRequested = "ANNUAL".equalsIgnoreCase(leaveType);
            boolean isAnnualExisting = "ANNUAL".equalsIgnoreCase(existing.getLeaveType());
            if ((isAnnualRequested && !isAnnualExisting) || (!isAnnualRequested && isAnnualExisting)) {
                boolean isContiguous = existing.getEndDate().plusDays(1).equals(reqStart) ||
                        reqEnd.plusDays(1).equals(existing.getStartDate());
                if (isContiguous) {
                    throw new RuntimeException(
                            "Annual leaves must be considered separately and cannot be combined or bridged with other categories of leave.");
                }
            }
        }

        // ---- Balance & Accrual Check ----
        boolean wantsCompanySponsored = requestDTO.getIsCompanySponsored() == null ? true : requestDTO.getIsCompanySponsored();
        boolean isCompanySponsored = false;
        String payStatus = "UNPAID_LEAVE_OF_ABSENCE";

        if (!isUnpaid && wantsCompanySponsored) {
            LeaveBalance balance = leaveBalanceRepository
                    .findByUserIdAndLeaveType(applicantId, leaveType)
                    .orElseGet(() -> {
                        double defaultDays = policy != null && policy.getDefaultDays() != null ? policy.getDefaultDays() : 0.0;
                        return leaveBalanceRepository.save(new LeaveBalance(null, applicant, leaveType, defaultDays, 0.0));
                    });

            // Derive accrual values from policy (no hardcoded fallbacks)
            String frequency = policy != null && policy.getAccrualFrequency() != null
                    ? policy.getAccrualFrequency() : "MONTHLY";
            Double rate = policy != null && policy.getAccrualRate() != null
                    ? policy.getAccrualRate()
                    : (balance.getTotalLeaves() != null && balance.getTotalLeaves() > 0 ? Math.max(1.0, Math.round(balance.getTotalLeaves() / 12.0)) : 1.0);

            int currentMonth = LocalDate.now().getMonthValue();
            int joinMonth = (applicant.getHireDate() != null && applicant.getHireDate().getYear() == LocalDate.now().getYear())
                    ? applicant.getHireDate().getMonthValue() : 1;
            int elapsedMonths = Math.max(1, currentMonth - joinMonth + 1);

            double totalAnnual = balance.getTotalLeaves() != null ? balance.getTotalLeaves() : 0.0;
            double accrued = "MONTHLY".equalsIgnoreCase(frequency)
                    ? Math.min(totalAnnual, Math.round(elapsedMonths * rate * 100.0) / 100.0)
                    : totalAnnual;
            double used = balance.getUsedLeaves() != null ? balance.getUsedLeaves() : 0.0;
            double remaining = Math.round((accrued - used) * 100.0) / 100.0;

            // ---- Balance Limit Enforcement (policy-driven) ----
            boolean enforceLimit = policy == null || !Boolean.FALSE.equals(policy.getPreventExceedingLimit());
            boolean allowException = policy != null && Boolean.TRUE.equals(policy.getAllowSpecialExceptions());

            // Check if applicant is HR_ADMIN (can bypass if allowSpecialExceptions is true)
            boolean isApplicantAdmin = applicant.getRoles().stream()
                    .anyMatch(r -> r.getRole() == RoleName.HR_ADMIN);

            if (enforceLimit && remaining < workingDays) {
                // Check negative balance allowance
                boolean allowNegative = policy != null && Boolean.TRUE.equals(policy.getAllowNegativeBalance());
                double maxNeg = policy != null && policy.getMaxNegativeLimit() != null ? policy.getMaxNegativeLimit() : 0.0;

                if (allowNegative && ((remaining + maxNeg) >= workingDays)) {
                    // Allowed advance borrow within negative limit
                } else if (allowException && isApplicantAdmin) {
                    // HR Admin exception bypass
                } else {
                    throw new RuntimeException("Insufficient accrued leave balance (" + Math.max(0.0, remaining)
                            + " days available). In " + LocalDate.now().getMonth().name()
                            + " you have accrued " + accrued + " days of your " + totalAnnual
                            + " annual quota. You can apply up to " + Math.max(0.0, remaining)
                            + " days as paid leave and the remaining " + Math.round((workingDays - remaining) * 100.0) / 100.0
                            + " days as Unpaid Leave (Loss of Pay).");
                }
            }

            isCompanySponsored = true;
            payStatus = "COMPANY_SPONSORED";
        } else if (!isUnpaid) {
            // Non-company sponsored paid leave — no balance deduction
            isCompanySponsored = false;
            payStatus = "UNPAID_LEAVE_OF_ABSENCE";
        }

        // ---- Create Leave Request ----
        LeaveRequest request = new LeaveRequest();
        request.setApplicant(applicant);
        request.setStartDate(reqStart);
        request.setEndDate(reqEnd);
        request.setLeaveType(leaveType);
        request.setReason(requestDTO.getReason());
        request.setTotalDays(workingDays);
        request.setIsCompanySponsored(isCompanySponsored);
        request.setPayStatus(payStatus);

        // ---- Approval Workflow Chain (policy-driven) ----
        String initialStatus = determineInitialApprovalStatus(policy, applicant);
        if ("APPROVED".equals(initialStatus)) {
            // AUTO_APPROVE chain — immediately approve and deduct balance
            request.setStatus("APPROVED");
            if (isCompanySponsored && !isUnpaid) {
                deductBalance(applicantId, leaveType, workingDays, applicant);
                request.setDeductedDays(workingDays);
            } else {
                request.setDeductedDays(0.0);
            }
        } else {
            request.setStatus(initialStatus);
            request.setDeductedDays(0.0);
            if ("PENDING_MANAGER".equals(initialStatus) && applicant.getManager() != null) {
                request.setManagerApprover(applicant.getManager());
            }
        }

        LeaveRequest saved = leaveRequestRepository.save(request);
        TimeOffResponseDTO dto = mapToDTO(saved);
        sseEmitterService.broadcast("LEAVE_UPDATE", dto);
        return dto;
    }

    /**
     * Determines the initial approval routing status based on the policy's
     * configurable approval workflow chain (approvalStep1/2/3).
     */
    private String determineInitialApprovalStatus(LeavePolicy policy, User applicant) {
        String step1 = policy != null && policy.getApprovalStep1() != null ? policy.getApprovalStep1() : "MANAGER";
        String step2 = policy != null && policy.getApprovalStep2() != null ? policy.getApprovalStep2() : "HR";
        String step3 = policy != null && policy.getApprovalStep3() != null ? policy.getApprovalStep3() : "SKIP";

        boolean isApplicantHR = applicant.getRoles().stream()
                .anyMatch(r -> r.getRole() == RoleName.HR && r.getRole() != RoleName.HR_ADMIN);
        boolean isApplicantAdmin = applicant.getRoles().stream()
                .anyMatch(r -> r.getRole() == RoleName.HR_ADMIN);

        // Determine first non-SKIP, non-AUTO_APPROVE step
        String effectiveStep1 = resolveStep(step1, applicant);

        if ("AUTO_APPROVE".equals(effectiveStep1)) {
            String effectiveStep2 = resolveStep(step2, applicant);
            if ("AUTO_APPROVE".equals(effectiveStep2) || "SKIP".equals(effectiveStep2)) {
                String effectiveStep3 = resolveStep(step3, applicant);
                if ("AUTO_APPROVE".equals(effectiveStep3) || "SKIP".equals(effectiveStep3)) {
                    return "APPROVED";
                }
                return stepToStatus(effectiveStep3);
            }
            return stepToStatus(effectiveStep2);
        }

        if ("SKIP".equals(effectiveStep1)) {
            // Step 1 skipped — move to step 2
            String effectiveStep2 = resolveStep(step2, applicant);
            if ("AUTO_APPROVE".equals(effectiveStep2) || "SKIP".equals(effectiveStep2)) {
                String effectiveStep3 = resolveStep(step3, applicant);
                if ("AUTO_APPROVE".equals(effectiveStep3) || "SKIP".equals(effectiveStep3)) {
                    return "APPROVED";
                }
                return stepToStatus(effectiveStep3);
            }
            return stepToStatus(effectiveStep2);
        }

        // Standard: route to the first step
        // HR applicant requesting through MANAGER → after manager, elevate to ADMIN instead of HR
        if ("MANAGER".equals(effectiveStep1) && applicant.getManager() != null) {
            return "PENDING_MANAGER";
        } else if ("MANAGER".equals(effectiveStep1) && applicant.getManager() == null) {
            // No manager assigned — fall through to step 2
            if (isApplicantHR) return "PENDING_ADMIN";
            if (isApplicantAdmin) return "PENDING_ADMIN";
            return stepToStatus(resolveStep(step2, applicant));
        }

        return stepToStatus(effectiveStep1);
    }

    private String resolveStep(String step, User applicant) {
        if (step == null || step.trim().isEmpty()) return "SKIP";
        return step.trim().toUpperCase();
    }

    private String stepToStatus(String step) {
        switch (step) {
            case "MANAGER": return "PENDING_MANAGER";
            case "HR": return "PENDING_HR";
            case "ADMIN": return "PENDING_ADMIN";
            case "AUTO_APPROVE": return "APPROVED";
            case "SKIP": return "APPROVED";
            default: return "PENDING_HR";
        }
    }

    /**
     * Determines the next approval status after a step is approved,
     * based on the policy's workflow chain.
     */
    private String getNextApprovalStatus(LeavePolicy policy, String currentStatus, User applicant) {
        String step1 = policy != null && policy.getApprovalStep1() != null ? policy.getApprovalStep1().toUpperCase() : "MANAGER";
        String step2 = policy != null && policy.getApprovalStep2() != null ? policy.getApprovalStep2().toUpperCase() : "HR";
        String step3 = policy != null && policy.getApprovalStep3() != null ? policy.getApprovalStep3().toUpperCase() : "SKIP";

        boolean isApplicantHR = applicant.getRoles().stream()
                .anyMatch(r -> r.getRole() == RoleName.HR && r.getRole() != RoleName.HR_ADMIN);

        if ("PENDING_MANAGER".equals(currentStatus)) {
            // Manager approved — move to step 2
            if ("SKIP".equals(step2) || "AUTO_APPROVE".equals(step2)) {
                if ("SKIP".equals(step3) || "AUTO_APPROVE".equals(step3)) {
                    return "APPROVED";
                }
                return stepToStatus(step3);
            }
            // If applicant is HR, elevate to ADMIN instead of HR for unbiased compliance
            if (isApplicantHR && "HR".equals(step2)) {
                return "PENDING_ADMIN";
            }
            return stepToStatus(step2);
        }

        if ("PENDING_HR".equals(currentStatus)) {
            // HR approved — move to step 3
            if ("SKIP".equals(step3) || "AUTO_APPROVE".equals(step3)) {
                return "APPROVED";
            }
            return stepToStatus(step3);
        }

        if ("PENDING_ADMIN".equals(currentStatus)) {
            // Admin approved — final step
            return "APPROVED";
        }

        return "APPROVED";
    }

    /**
     * Resolves which leave categories to check for overlap prevention,
     * based on the policy's preventOverlapWith configuration.
     */
    private Set<String> resolveOverlapCategories(LeavePolicy policy) {
        if (policy == null || policy.getPreventOverlapWith() == null
                || policy.getPreventOverlapWith().trim().isEmpty()
                || "ALL".equalsIgnoreCase(policy.getPreventOverlapWith().trim())) {
            return Set.of("ALL");
        }
        return java.util.Arrays.stream(policy.getPreventOverlapWith().split(","))
                .map(s -> s.trim().toUpperCase())
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    private void deductBalance(Long userId, String leaveType, double days, User applicant) {
        LeaveBalance balance = leaveBalanceRepository
                .findByUserIdAndLeaveType(userId, leaveType)
                .orElseGet(() -> {
                    LeavePolicy p = findBestMatchingPolicy(leaveType, applicant);
                    double defaultDays = p != null && p.getDefaultDays() != null ? p.getDefaultDays() : 0.0;
                    return leaveBalanceRepository.save(new LeaveBalance(null, applicant, leaveType, defaultDays, 0.0));
                });
        balance.setUsedLeaves((balance.getUsedLeaves() != null ? balance.getUsedLeaves() : 0.0) + days);
        leaveBalanceRepository.save(balance);
    }

    // =========================================================================
    // QUERY METHODS
    // =========================================================================

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
        java.util.LinkedHashSet<LeaveRequest> pendingSet = new java.util.LinkedHashSet<>();
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

    // =========================================================================
    // USER SUMMARY WITH LEAVE STATS (policy-driven, no hardcoded fallbacks)
    // =========================================================================

    public com.leavemanagement.payload.UserSummaryDTO getUserSummaryWithLeaveStats(User u) {
        com.leavemanagement.payload.UserSummaryDTO dto = new com.leavemanagement.payload.UserSummaryDTO();
        dto.setId(u.getId());
        dto.setName(u.getName());
        dto.setEmail(u.getEmail());
        dto.setRoles(u.getRoles().stream().map(r -> "ROLE_" + r.getRole().name()).collect(Collectors.toList()));
        dto.setManagerName(u.getManager() != null ? u.getManager().getName() : null);
        dto.setManagerId(u.getManager() != null ? u.getManager().getId() : null);
        dto.setDepartment(u.getDepartment());
        dto.setDesignation(u.getDesignation());
        dto.setEmployeeType(u.getEmployeeType());
        dto.setRegion(u.getRegion() != null ? u.getRegion() : "Global");
        dto.setHireDate(u.getHireDate());

        List<LeaveBalance> balances = leaveBalanceRepository.findByUserId(u.getId());
        double totalPtoAllocated = 0.0;
        double totalPtoUsed = 0.0;
        double totalPtoAvailable = 0.0;

        int currentMonth = LocalDate.now().getMonthValue();
        List<com.leavemanagement.payload.LeaveBalanceDTO> balanceDTOs = new java.util.ArrayList<>();

        for (LeaveBalance b : balances) {
            double total = b.getTotalLeaves() != null ? b.getTotalLeaves() : 0.0;
            double used = b.getUsedLeaves() != null ? b.getUsedLeaves() : 0.0;

            // Resolve matching policy for this user + leave type (no hardcoded fallbacks)
            LeavePolicy policy = findBestMatchingPolicy(b.getLeaveType(), u);

            String frequency = policy != null && policy.getAccrualFrequency() != null
                    ? policy.getAccrualFrequency() : "MONTHLY";
            Double rate = policy != null && policy.getAccrualRate() != null
                    ? Math.round(policy.getAccrualRate() * 100.0) / 100.0
                    : (total > 0 ? Math.max(1.0, Math.round(total / 12.0)) : 1.0);

            int joinMonth = (u.getHireDate() != null && u.getHireDate().getYear() == LocalDate.now().getYear())
                    ? u.getHireDate().getMonthValue()
                    : 1;
            int elapsedMonths = Math.max(1, currentMonth - joinMonth + 1);

            double accrued = "MONTHLY".equalsIgnoreCase(frequency)
                    ? Math.min(total, Math.round(elapsedMonths * rate * 100.0) / 100.0)
                    : total;
            double available = Math.max(0.0, Math.round((accrued - used) * 100.0) / 100.0);

            totalPtoAllocated += total;
            totalPtoUsed += used;
            totalPtoAvailable += available;

            balanceDTOs.add(new com.leavemanagement.payload.LeaveBalanceDTO(
                    b.getId(),
                    b.getLeaveType(),
                    total,
                    used,
                    accrued,
                    available,
                    rate,
                    frequency
            ));
        }

        // Calculate Non-Paid Off (Unpaid / LOP) from approved leave requests
        List<LeaveRequest> userLeaves = leaveRequestRepository.findByApplicantId(u.getId());
        double totalUnpaidDays = userLeaves.stream()
                .filter(lr -> "APPROVED".equalsIgnoreCase(lr.getStatus()))
                .filter(lr -> Boolean.FALSE.equals(lr.getIsCompanySponsored()) || "UNPAID".equalsIgnoreCase(lr.getLeaveType()))
                .mapToDouble(lr -> lr.getTotalDays() != null ? lr.getTotalDays() : 0.0)
                .sum();

        dto.setTotalPtoAllocated(Math.round(totalPtoAllocated * 100.0) / 100.0);
        dto.setTotalPtoUsed(Math.round(totalPtoUsed * 100.0) / 100.0);
        dto.setTotalPtoAvailable(Math.round(totalPtoAvailable * 100.0) / 100.0);
        dto.setTotalUnpaidDays(Math.round(totalUnpaidDays * 100.0) / 100.0);
        dto.setLeaveBalances(balanceDTOs);

        return dto;
    }

    public List<com.leavemanagement.payload.UserSummaryDTO> getDirectReportees(Long managerId) {
        return userRepository.findByManagerId(managerId).stream()
                .map(this::getUserSummaryWithLeaveStats)
                .collect(Collectors.toList());
    }

    public List<com.leavemanagement.payload.UserSummaryDTO> getAllEmployeesSummary() {
        return userRepository.findAll().stream()
                .map(this::getUserSummaryWithLeaveStats)
                .collect(Collectors.toList());
    }

    // =========================================================================
    // PROCESS LEAVE REQUEST — Policy-driven workflow chain
    // =========================================================================

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

        // Resolve the policy for workflow chain
        LeavePolicy policy = findBestMatchingPolicy(leaveRequest.getLeaveType(), leaveRequest.getApplicant());

        if ("PENDING_MANAGER".equals(leaveRequest.getStatus())) {
            if (isDesignatedManager || isAdmin) {
                if ("APPROVE".equalsIgnoreCase(action)) {
                    String nextStatus = getNextApprovalStatus(policy, "PENDING_MANAGER", leaveRequest.getApplicant());
                    leaveRequest.setStatus(nextStatus);
                    if ("APPROVED".equals(nextStatus)) {
                        finalizeApproval(leaveRequest, processor);
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
                    String nextStatus = getNextApprovalStatus(policy, "PENDING_HR", leaveRequest.getApplicant());
                    leaveRequest.setStatus(nextStatus);
                    leaveRequest.setHrApprover(processor);
                    if ("APPROVED".equals(nextStatus)) {
                        finalizeApproval(leaveRequest, processor);
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
                    finalizeApproval(leaveRequest, processor);
                } else if ("REJECT".equalsIgnoreCase(action)) {
                    leaveRequest.setStatus("REJECTED");
                    leaveRequest.setHrApprover(processor);
                }
            } else {
                throw new RuntimeException("Only an HR Admin can approve leave requests at this stage.");
            }
        } else {
            throw new RuntimeException("Leave request is not in a pending state (Current status: " + leaveRequest.getStatus() + ").");
        }

        TimeOffResponseDTO dto = mapToDTO(leaveRequestRepository.save(leaveRequest));
        sseEmitterService.broadcast("LEAVE_UPDATE", dto);
        return dto;
    }

    private void finalizeApproval(LeaveRequest leaveRequest, User processor) {
        leaveRequest.setHrApprover(processor);
        // Deduct balance if company-sponsored
        if (Boolean.TRUE.equals(leaveRequest.getIsCompanySponsored())
                && !"UNPAID".equalsIgnoreCase(leaveRequest.getLeaveType())) {
            double alreadyDeducted = leaveRequest.getDeductedDays() != null ? leaveRequest.getDeductedDays() : 0.0;
            double toDeduct = Math.max(0.0, leaveRequest.getTotalDays() - alreadyDeducted);

            if (toDeduct > 0) {
                // Check balance limit at approval time across all levels
                LeavePolicy policy = findBestMatchingPolicy(leaveRequest.getLeaveType(), leaveRequest.getApplicant());
                boolean enforceLimit = policy == null || !Boolean.FALSE.equals(policy.getPreventExceedingLimit());
                boolean allowException = policy != null && Boolean.TRUE.equals(policy.getAllowSpecialExceptions());
                boolean isApplicantAdmin = leaveRequest.getApplicant().getRoles().stream()
                        .anyMatch(r -> r.getRole() == RoleName.HR_ADMIN);
                boolean isProcessorAdmin = processor.getRoles().stream()
                        .anyMatch(r -> r.getRole() == RoleName.HR_ADMIN);

                LeaveBalance balance = leaveBalanceRepository
                        .findByUserIdAndLeaveType(leaveRequest.getApplicant().getId(), leaveRequest.getLeaveType())
                        .orElse(null);

                if (balance != null && enforceLimit) {
                    String frequency = policy != null && policy.getAccrualFrequency() != null
                            ? policy.getAccrualFrequency() : "MONTHLY";
                    Double rate = policy != null && policy.getAccrualRate() != null
                            ? policy.getAccrualRate()
                            : (balance.getTotalLeaves() != null && balance.getTotalLeaves() > 0 ? Math.max(1.0, Math.round(balance.getTotalLeaves() / 12.0)) : 1.0);

                    int currentMonth = LocalDate.now().getMonthValue();
                    int joinMonth = (leaveRequest.getApplicant().getHireDate() != null && leaveRequest.getApplicant().getHireDate().getYear() == LocalDate.now().getYear())
                            ? leaveRequest.getApplicant().getHireDate().getMonthValue() : 1;
                    int elapsedMonths = Math.max(1, currentMonth - joinMonth + 1);

                    double totalAnnual = balance.getTotalLeaves() != null ? balance.getTotalLeaves() : 0.0;
                    double accrued = "MONTHLY".equalsIgnoreCase(frequency)
                            ? Math.min(totalAnnual, Math.round(elapsedMonths * rate * 100.0) / 100.0)
                            : totalAnnual;
                    double used = balance.getUsedLeaves() != null ? balance.getUsedLeaves() : 0.0;
                    double remaining = Math.round((accrued - used) * 100.0) / 100.0;

                    if (remaining < toDeduct) {
                        boolean allowNegative = policy != null && Boolean.TRUE.equals(policy.getAllowNegativeBalance());
                        double maxNeg = policy != null && policy.getMaxNegativeLimit() != null ? policy.getMaxNegativeLimit() : 0.0;

                        if (allowNegative && ((remaining + maxNeg) >= toDeduct)) {
                            // Allowed advance borrow within negative limit
                        } else if (allowException && (isProcessorAdmin || isApplicantAdmin)) {
                            // HR Admin exception bypass
                        } else {
                            throw new RuntimeException("Cannot approve request: Applicant's available leave balance ("
                                    + Math.max(0.0, remaining) + " days available) is insufficient to deduct the required "
                                    + toDeduct + " additional days. Exceeding balance limit is prevented by policy.");
                        }
                    }
                }

                // Deduct ONLY the additional delta days, NOT the entire already-approved quota
                deductBalance(leaveRequest.getApplicant().getId(),
                        leaveRequest.getLeaveType(),
                        toDeduct,
                        leaveRequest.getApplicant());
                leaveRequest.setDeductedDays(alreadyDeducted + toDeduct);
            }
        }
    }

    // =========================================================================
    // WITHDRAW LEAVE
    // =========================================================================

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
            // Refund only what was actually deducted from balance
            if (Boolean.TRUE.equals(leaveRequest.getIsCompanySponsored())
                    && !"UNPAID".equalsIgnoreCase(leaveRequest.getLeaveType())) {
                double refundDays = leaveRequest.getDeductedDays() != null ? leaveRequest.getDeductedDays() : leaveRequest.getTotalDays();
                if (refundDays > 0) {
                    leaveBalanceRepository.findByUserIdAndLeaveType(applicantId, leaveRequest.getLeaveType())
                            .ifPresent(balance -> {
                                balance.setUsedLeaves(Math.max(0.0, (balance.getUsedLeaves() != null ? balance.getUsedLeaves() : 0.0) - refundDays));
                                leaveBalanceRepository.save(balance);
                            });
                    leaveRequest.setDeductedDays(0.0);
                }
            }
        }

        leaveRequest.setStatus("WITHDRAWN");
        TimeOffResponseDTO dto = mapToDTO(leaveRequestRepository.save(leaveRequest));
        sseEmitterService.broadcast("LEAVE_UPDATE", dto);
        return dto;
    }

    // =========================================================================
    // EXTEND LEAVE — Full policy enforcement & delta deduction
    // =========================================================================

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

        User applicant = leaveRequest.getApplicant();
        LeavePolicy policy = findBestMatchingPolicy(leaveRequest.getLeaveType(), applicant);

        // ---- Policy Period Validation for extension ----
        if (policy != null && policy.getEndDate() != null && newEndDate.isAfter(policy.getEndDate())) {
            throw new RuntimeException("Extension end date (" + newEndDate + ") exceeds the policy expiry date (" + policy.getEndDate() + ").");
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

            String frequency = policy != null && policy.getAccrualFrequency() != null
                    ? policy.getAccrualFrequency() : "MONTHLY";
            Double rate = policy != null && policy.getAccrualRate() != null
                    ? policy.getAccrualRate()
                    : (balance.getTotalLeaves() != null && balance.getTotalLeaves() > 0 ? Math.max(1.0, Math.round(balance.getTotalLeaves() / 12.0)) : 1.0);

            int currentMonth = LocalDate.now().getMonthValue();
            int joinMonth = (applicant.getHireDate() != null && applicant.getHireDate().getYear() == LocalDate.now().getYear())
                    ? applicant.getHireDate().getMonthValue() : 1;
            int elapsedMonths = Math.max(1, currentMonth - joinMonth + 1);

            double totalAnnual = balance.getTotalLeaves() != null ? balance.getTotalLeaves() : 0.0;
            double accrued = "MONTHLY".equalsIgnoreCase(frequency)
                    ? Math.min(totalAnnual, Math.round(elapsedMonths * rate * 100.0) / 100.0)
                    : totalAnnual;
            double used = balance.getUsedLeaves() != null ? balance.getUsedLeaves() : 0.0;
            double remaining = Math.round((accrued - used) * 100.0) / 100.0;

            boolean enforceLimit = policy == null || !Boolean.FALSE.equals(policy.getPreventExceedingLimit());
            boolean allowException = policy != null && Boolean.TRUE.equals(policy.getAllowSpecialExceptions());
            boolean isApplicantAdmin = applicant.getRoles().stream().anyMatch(r -> r.getRole() == RoleName.HR_ADMIN);

            if (enforceLimit && remaining < additionalWorkingDays) {
                boolean allowNegative = policy != null && Boolean.TRUE.equals(policy.getAllowNegativeBalance());
                double maxNeg = policy != null && policy.getMaxNegativeLimit() != null ? policy.getMaxNegativeLimit() : 0.0;

                if (allowNegative && ((remaining + maxNeg) >= additionalWorkingDays)) {
                    // Allowed advance borrow within negative limit
                } else if (allowException && isApplicantAdmin) {
                    // HR Admin exception bypass
                } else {
                    throw new RuntimeException("Insufficient accrued balance for extension (" + Math.max(0.0, remaining)
                            + " days available). You are extending by " + additionalWorkingDays + " additional working days for "
                            + leaveRequest.getLeaveType() + " leave, which exceeds your available balance limit ("
                            + Math.max(0.0, remaining) + " days available).");
                }
            }
        }

        // Update leave request dates and total days
        leaveRequest.setEndDate(newEndDate);
        leaveRequest.setTotalDays(leaveRequest.getTotalDays() + additionalWorkingDays);
        if (reason != null && !reason.trim().isEmpty()) {
            leaveRequest.setReason((leaveRequest.getReason() != null ? leaveRequest.getReason() + " | " : "") + "[Extended to " + newEndDate + ": " + reason.trim() + "]");
        }

        // Route through approval workflow using policy chain
        String newStatus = determineInitialApprovalStatus(policy, applicant);
        if ("APPROVED".equals(newStatus)) {
            leaveRequest.setStatus("APPROVED");
            // If auto-approved, deduct only the additional delta working days
            if (Boolean.TRUE.equals(leaveRequest.getIsCompanySponsored()) && !"UNPAID".equalsIgnoreCase(leaveRequest.getLeaveType())) {
                deductBalance(applicantId, leaveRequest.getLeaveType(), additionalWorkingDays, applicant);
                leaveRequest.setDeductedDays((leaveRequest.getDeductedDays() != null ? leaveRequest.getDeductedDays() : 0.0) + additionalWorkingDays);
            }
        } else {
            leaveRequest.setStatus(newStatus);
            if ("PENDING_MANAGER".equals(newStatus) && applicant.getManager() != null) {
                leaveRequest.setManagerApprover(applicant.getManager());
            }
        }

        LeaveRequest saved = leaveRequestRepository.save(leaveRequest);
        TimeOffResponseDTO dto = mapToDTO(saved);
        sseEmitterService.broadcast("LEAVE_UPDATE", dto);
        return dto;
    }

    // =========================================================================
    // DTO MAPPING
    // =========================================================================

    private TimeOffResponseDTO mapToDTO(LeaveRequest request) {
        TimeOffResponseDTO dto = new TimeOffResponseDTO();
        dto.setId(request.getId());
        dto.setWorkerId(request.getApplicant().getId().toString());
        dto.setWorkerName(request.getApplicant().getName());
        dto.setTimeOffType(request.getLeaveType());
        dto.setStartDate(request.getStartDate());
        dto.setEndDate(request.getEndDate());
        dto.setTotalQuantity(request.getTotalDays());
        dto.setDailyQuantity(1.0);
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

    // =========================================================================
    // PRORATION — Policy-driven rounding & basis
    // =========================================================================

    public double calculateProratedQuota(LeavePolicy policy, LocalDate joinDate,
            LocalDate periodStart, LocalDate periodEnd) {
        if (policy == null || policy.getDefaultDays() == null)
            return 0.0;

        // If proration is disabled, return full quota
        if (Boolean.FALSE.equals(policy.getIsProrated())) {
            return policy.getDefaultDays();
        }

        double fullQuota = policy.getDefaultDays();

        LocalDate start = periodStart != null ? periodStart
                : (policy.getEffectiveDate() != null ? policy.getEffectiveDate()
                        : LocalDate.of(LocalDate.now().getYear(), 1, 1));
        LocalDate end = periodEnd != null ? periodEnd
                : (policy.getEndDate() != null ? policy.getEndDate() : start.plusYears(1).minusDays(1));

        LocalDate effectiveJoin = (joinDate != null && joinDate.isAfter(start)) ? joinDate : start;
        if (effectiveJoin.isAfter(end))
            return 0.0;

        // Determine proration basis
        String basis = policy.getProrationBasis() != null ? policy.getProrationBasis() : "HIRE_DATE";

        if ("HIRE_DATE".equalsIgnoreCase(basis) || "POLICY_PERIOD".equalsIgnoreCase(basis)) {
            // If monthly accrual, calculate clean integer remaining months * rate
            if ("MONTHLY".equalsIgnoreCase(policy.getAccrualFrequency()) && policy.getAccrualRate() != null && policy.getAccrualRate() > 0) {
                int joinMonth = effectiveJoin.getYear() == start.getYear() ? effectiveJoin.getMonthValue() : 1;
                int endMonth = end.getMonthValue();
                int remainingMonths = Math.max(1, endMonth - joinMonth + 1);
                double rawQuota = remainingMonths * policy.getAccrualRate();
                double roundedQuota = applyProrationRounding(rawQuota, policy.getProrationRounding());
                return Math.min(fullQuota, roundedQuota);
            }

            // Day-based proration
            long totalDaysInPeriod = ChronoUnit.DAYS.between(start, end) + 1;
            long remainingDays = ChronoUnit.DAYS.between(effectiveJoin, end) + 1;

            if (totalDaysInPeriod <= 0 || remainingDays >= totalDaysInPeriod)
                return fullQuota;

            double rawProrated = fullQuota * ((double) remainingDays / (double) totalDaysInPeriod);
            return Math.max(1.0, applyProrationRounding(rawProrated, policy.getProrationRounding()));
        }

        // FTE_HOURS basis — for now treat same as day-based (would need FTE ratio from user)
        long totalDaysInPeriod = ChronoUnit.DAYS.between(start, end) + 1;
        long remainingDays = ChronoUnit.DAYS.between(effectiveJoin, end) + 1;
        if (totalDaysInPeriod <= 0 || remainingDays >= totalDaysInPeriod)
            return fullQuota;
        double rawProrated = fullQuota * ((double) remainingDays / (double) totalDaysInPeriod);
        return Math.max(1.0, applyProrationRounding(rawProrated, policy.getProrationRounding()));
    }

    /**
     * Applies the configured proration rounding rule.
     */
    private double applyProrationRounding(double value, String roundingRule) {
        if (roundingRule == null) roundingRule = "ROUND_UP";

        switch (roundingRule.toUpperCase()) {
            case "ROUND_UP":
                return Math.ceil(value);
            case "ROUND_DOWN":
                return Math.floor(value);
            case "ROUND_HALF":
                return Math.round(value * 2.0) / 2.0; // Round to nearest 0.5
            case "EXACT":
                return Math.round(value * 100.0) / 100.0; // 2 decimal places
            default:
                return Math.round(value);
        }
    }

    // =========================================================================
    // POLICY APPLICABILITY CHECKS
    // =========================================================================

    public boolean isPolicyApplicableToUser(LeavePolicy policy, User user) {
        if (policy == null || user == null) return false;

        // 1. Role Eligibility
        Set<String> userRoles = user.getRoles().stream()
                .map(r -> r.getRole().name())
                .collect(Collectors.toSet());
        if (!isPolicyApplicableToUserRoles(policy.getEligibleRole(), userRoles)) {
            return false;
        }

        // 2. Region Eligibility
        if (policy.getRegion() != null && !policy.getRegion().trim().isEmpty()
                && !"ALL".equalsIgnoreCase(policy.getRegion().trim())
                && !"GLOBAL".equalsIgnoreCase(policy.getRegion().trim())) {
            String userRegion = user.getRegion() != null ? user.getRegion().trim() : "Global";
            if (!policy.getRegion().trim().equalsIgnoreCase(userRegion)) {
                return false;
            }
        }

        // 3. Employee Type Eligibility
        if (policy.getEmployeeType() != null && !policy.getEmployeeType().trim().isEmpty()
                && !"ALL".equalsIgnoreCase(policy.getEmployeeType().trim())) {
            String userType = user.getEmployeeType() != null ? user.getEmployeeType().trim() : "FULL_TIME";
            if (!policy.getEmployeeType().trim().equalsIgnoreCase(userType)) {
                return false;
            }
        }

        // 4. Department Eligibility
        if (policy.getDepartment() != null && !policy.getDepartment().trim().isEmpty()
                && !"ALL".equalsIgnoreCase(policy.getDepartment().trim())
                && !"ALL DEPARTMENTS".equalsIgnoreCase(policy.getDepartment().trim())) {
            String userDept = user.getDepartment() != null ? user.getDepartment().trim() : "General";
            if (!policy.getDepartment().trim().equalsIgnoreCase(userDept)) {
                return false;
            }
        }

        // 5. Tenure Eligibility
        if (policy.getTenureMonths() != null && policy.getTenureMonths() > 0 && user.getHireDate() != null) {
            long months = ChronoUnit.MONTHS.between(user.getHireDate(), LocalDate.now());
            if (months < policy.getTenureMonths()) {
                return false;
            }
        }

        return true;
    }

    private boolean isPolicyApplicableToUserRoles(String eligibleRole, Set<String> userRoles) {
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
            case "EMPLOYEE_MANAGER":
                return "EMPLOYEE".equals(primaryRole) || "MANAGER".equals(primaryRole) || "HR".equals(primaryRole) || "HR_ADMIN".equals(primaryRole);
            default:
                return true;
        }
    }
}
