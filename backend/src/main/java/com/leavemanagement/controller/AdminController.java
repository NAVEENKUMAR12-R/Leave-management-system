package com.leavemanagement.controller;

import com.leavemanagement.model.LeavePolicy;
import com.leavemanagement.repository.LeavePolicyRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/admin/policies")
public class AdminController {

    private final LeavePolicyRepository leavePolicyRepository;
    private final com.leavemanagement.repository.UserRepository userRepository;
    private final com.leavemanagement.repository.LeaveBalanceRepository leaveBalanceRepository;
    private final com.leavemanagement.service.LeaveService leaveService;
    private final com.leavemanagement.service.SseEmitterService sseEmitterService;

    public AdminController(LeavePolicyRepository leavePolicyRepository,
                           com.leavemanagement.repository.UserRepository userRepository,
                           com.leavemanagement.repository.LeaveBalanceRepository leaveBalanceRepository,
                           com.leavemanagement.service.LeaveService leaveService,
                           com.leavemanagement.service.SseEmitterService sseEmitterService) {
        this.leavePolicyRepository = leavePolicyRepository;
        this.userRepository = userRepository;
        this.leaveBalanceRepository = leaveBalanceRepository;
        this.leaveService = leaveService;
        this.sseEmitterService = sseEmitterService;
    }

    @GetMapping
    @PreAuthorize("hasRole('HR_ADMIN')")
    public ResponseEntity<List<LeavePolicy>> getPolicies() {
        return ResponseEntity.ok(leavePolicyRepository.findAll());
    }

    @PostMapping
    @PreAuthorize("hasRole('HR_ADMIN')")
    public ResponseEntity<LeavePolicy> createOrUpdatePolicy(@RequestBody LeavePolicy policy) {
        LeavePolicy saved = leavePolicyRepository.save(policy);
        syncPolicyToEligibleUsers(saved);
        sseEmitterService.broadcast("POLICY_UPDATE", saved);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/{id}/restart")
    @PreAuthorize("hasRole('HR_ADMIN')")
    public ResponseEntity<LeavePolicy> restartPolicy(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> body) {
        LeavePolicy oldPolicy = leavePolicyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Policy not found"));

        String newStartDateStr = body.get("newStartDate");
        String newEndDateStr = body.get("newEndDate");

        java.time.LocalDate newStart = newStartDateStr != null && !newStartDateStr.isBlank()
                ? java.time.LocalDate.parse(newStartDateStr)
                : java.time.LocalDate.now();
        java.time.LocalDate newEnd = newEndDateStr != null && !newEndDateStr.isBlank()
                ? java.time.LocalDate.parse(newEndDateStr)
                : newStart.plusYears(1);

        // Mark old policy as archived/expired
        oldPolicy.setIsActive(false);
        oldPolicy.setPolicyStatus("ARCHIVED");
        if (oldPolicy.getEndDate() == null) {
            oldPolicy.setEndDate(newStart.minusDays(1));
        }
        leavePolicyRepository.save(oldPolicy);

        // Create new renewed policy instance
        LeavePolicy newPolicy = new LeavePolicy();
        newPolicy.setPolicyName(oldPolicy.getPolicyName());
        newPolicy.setLeaveType(oldPolicy.getLeaveType());
        newPolicy.setEffectiveDate(newStart);
        newPolicy.setEndDate(newEnd);
        newPolicy.setIsActive(true);
        newPolicy.setPolicyStatus("ACTIVE");
        newPolicy.setRestartedFromId(oldPolicy.getId());
        newPolicy.setDescription(oldPolicy.getDescription());
        newPolicy.setEmployeeType(oldPolicy.getEmployeeType());
        newPolicy.setRegion(oldPolicy.getRegion());
        newPolicy.setTenureMonths(oldPolicy.getTenureMonths());
        newPolicy.setDepartment(oldPolicy.getDepartment());
        newPolicy.setGradeLevel(oldPolicy.getGradeLevel());
        newPolicy.setAccrualRate(oldPolicy.getAccrualRate());
        newPolicy.setAccrualFrequency(oldPolicy.getAccrualFrequency());
        newPolicy.setDefaultDays(oldPolicy.getDefaultDays());
        newPolicy.setAllowNegativeBalance(oldPolicy.getAllowNegativeBalance());
        newPolicy.setMaxNegativeLimit(oldPolicy.getMaxNegativeLimit());
        newPolicy.setIsCarryForwardAllowed(oldPolicy.getIsCarryForwardAllowed());
        newPolicy.setMaxCarryForwardDays(oldPolicy.getMaxCarryForwardDays());
        newPolicy.setExpirationMonths(oldPolicy.getExpirationMonths());
        newPolicy.setApprovalStep1(oldPolicy.getApprovalStep1());
        newPolicy.setApprovalStep2(oldPolicy.getApprovalStep2());
        newPolicy.setApprovalStep3(oldPolicy.getApprovalStep3());
        newPolicy.setPreventOverlapWith(oldPolicy.getPreventOverlapWith());
        newPolicy.setPreventExceedingLimit(oldPolicy.getPreventExceedingLimit());
        newPolicy.setAllowSpecialExceptions(oldPolicy.getAllowSpecialExceptions());
        newPolicy.setReportFrequency(oldPolicy.getReportFrequency());

        LeavePolicy savedRenewed = leavePolicyRepository.save(newPolicy);
        syncPolicyToEligibleUsers(savedRenewed);
        sseEmitterService.broadcast("POLICY_UPDATE", savedRenewed);
        return ResponseEntity.ok(savedRenewed);
    }

    @PostMapping("/{id}/restore")
    @PreAuthorize("hasRole('HR_ADMIN')")
    public ResponseEntity<LeavePolicy> restorePolicy(@PathVariable Long id) {
        LeavePolicy policy = leavePolicyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Policy not found"));

        policy.setIsActive(true);
        policy.setPolicyStatus("ACTIVE");
        if (policy.getEndDate() != null && policy.getEndDate().isBefore(java.time.LocalDate.now())) {
            policy.setEndDate(java.time.LocalDate.now().plusYears(1));
        }
        LeavePolicy restored = leavePolicyRepository.save(policy);
        syncPolicyToEligibleUsers(restored);
        sseEmitterService.broadcast("POLICY_UPDATE", restored);
        return ResponseEntity.ok(restored);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('HR_ADMIN')")
    public ResponseEntity<?> deletePolicy(
            @PathVariable Long id,
            @RequestParam(defaultValue = "false") boolean permanent) {
        LeavePolicy policy = leavePolicyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Policy not found"));

        if (permanent) {
            leavePolicyRepository.delete(policy);
            sseEmitterService.broadcast("POLICY_UPDATE", java.util.Map.of("deletedId", id, "permanent", true));
            return ResponseEntity.ok().body(java.util.Map.of("message", "Policy permanently removed from database"));
        } else {
            // Soft delete / Move to Policy History & Recycle Bin
            policy.setIsActive(false);
            policy.setPolicyStatus("ARCHIVED");
            if (policy.getEndDate() == null || policy.getEndDate().isAfter(java.time.LocalDate.now())) {
                policy.setEndDate(java.time.LocalDate.now());
            }
            LeavePolicy archived = leavePolicyRepository.save(policy);
            sseEmitterService.broadcast("POLICY_UPDATE", archived);
            return ResponseEntity.ok().body(java.util.Map.of("message", "Policy moved to Recycle Bin / History successfully"));
        }
    }

    private void syncPolicyToEligibleUsers(LeavePolicy policy) {
        if (policy == null || policy.getIsActive() == Boolean.FALSE || "ARCHIVED".equalsIgnoreCase(policy.getPolicyStatus())) {
            return;
        }

        String leaveType = policy.getLeaveType().toUpperCase();
        for (com.leavemanagement.model.User user : userRepository.findAll()) {
            if (leaveService.isPolicyApplicableToUser(policy, user)) {
                double quota = leaveService.calculateProratedQuota(
                        policy,
                        user.getHireDate(),
                        policy.getEffectiveDate(),
                        policy.getEndDate()
                );

                com.leavemanagement.model.LeaveBalance balance = leaveBalanceRepository
                        .findByUserIdAndLeaveType(user.getId(), leaveType)
                        .orElseGet(() -> new com.leavemanagement.model.LeaveBalance(null, user, leaveType, quota, 0.0));

                balance.setTotalLeaves(quota);
                if (balance.getUsedLeaves() == null) {
                    balance.setUsedLeaves(0.0);
                }
                leaveBalanceRepository.save(balance);
            }
        }
    }
}
