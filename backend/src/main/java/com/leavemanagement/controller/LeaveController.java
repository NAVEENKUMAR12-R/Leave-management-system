package com.leavemanagement.controller;

import com.leavemanagement.model.LeaveBalance;
import com.leavemanagement.payload.TimeOffRequestDTO;
import com.leavemanagement.payload.TimeOffResponseDTO;
import com.leavemanagement.repository.LeaveBalanceRepository;
import com.leavemanagement.security.UserDetailsImpl;
import com.leavemanagement.service.LeaveService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import com.leavemanagement.model.User;
import com.leavemanagement.repository.UserRepository;

import java.util.List;
import java.util.Map;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/leaves")
public class LeaveController {

    private final LeaveService leaveService;
    private final LeaveBalanceRepository leaveBalanceRepository;
    private final com.leavemanagement.repository.LeavePolicyRepository leavePolicyRepository;
    private final UserRepository userRepository;

    public LeaveController(LeaveService leaveService,
            LeaveBalanceRepository leaveBalanceRepository,
            com.leavemanagement.repository.LeavePolicyRepository leavePolicyRepository,
            UserRepository userRepository) {
        this.leaveService = leaveService;
        this.leaveBalanceRepository = leaveBalanceRepository;
        this.leavePolicyRepository = leavePolicyRepository;
        this.userRepository = userRepository;
    }

    @PostMapping("/apply")
    public ResponseEntity<TimeOffResponseDTO> applyLeave(@AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestBody TimeOffRequestDTO request) {
        return ResponseEntity.ok(leaveService.applyLeave(userDetails.getId(), request));
    }

    @GetMapping("/my-leaves")
    public ResponseEntity<List<TimeOffResponseDTO>> getMyLeaves(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getMyLeaves(userDetails.getId()));
    }

    @GetMapping("/my-balances")
    public ResponseEntity<List<com.leavemanagement.payload.LeaveBalanceDTO>> getMyBalances(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        int currentMonth = java.time.LocalDate.now().getMonthValue();

        User currentUser = userRepository.findById(userDetails.getId()).orElse(null);
        if (currentUser == null) {
            return ResponseEntity.ok(java.util.Collections.emptyList());
        }

        int joinMonth = (currentUser.getHireDate() != null && currentUser.getHireDate().getYear() == java.time.LocalDate.now().getYear())
                ? currentUser.getHireDate().getMonthValue()
                : 1;
        int elapsedMonths = Math.max(1, currentMonth - joinMonth + 1);

        List<com.leavemanagement.payload.LeaveBalanceDTO> dtos = leaveBalanceRepository
                .findByUserId(userDetails.getId())
                .stream()
                .map(b -> {
                    // Use the best matching policy for THIS user (not just any policy of this type)
                    com.leavemanagement.model.LeavePolicy policy = leaveService.findBestMatchingPolicy(b.getLeaveType(), currentUser);

                    // Skip balances where no active policy matches this user
                    if (policy == null) return null;

                    // Derive all values from the resolved policy (no hardcoded fallbacks)
                    String frequency = policy.getAccrualFrequency() != null
                            ? policy.getAccrualFrequency() : "MONTHLY";

                    double totalAnnual = b.getTotalLeaves() != null
                            ? b.getTotalLeaves()
                            : (policy.getDefaultDays() != null ? policy.getDefaultDays() : 0.0);

                    Double rate = policy.getAccrualRate() != null
                            ? Math.round(policy.getAccrualRate() * 100.0) / 100.0
                            : (totalAnnual > 0 ? Math.max(1.0, Math.round(totalAnnual / 12.0)) : 1.0);

                    double used = b.getUsedLeaves() != null ? b.getUsedLeaves() : 0.0;
                    double accrued;

                    if ("MONTHLY".equalsIgnoreCase(frequency)) {
                        accrued = Math.min(totalAnnual, Math.round(elapsedMonths * rate * 100.0) / 100.0);
                    } else {
                        accrued = totalAnnual;
                    }

                    double available = Math.max(0.0, Math.round((accrued - used) * 100.0) / 100.0);

                    return new com.leavemanagement.payload.LeaveBalanceDTO(
                            b.getId(),
                            b.getLeaveType(),
                            totalAnnual,
                            used,
                            accrued,
                            available,
                            rate,
                            frequency
                    );
                })
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/my-policies")
    public ResponseEntity<List<com.leavemanagement.model.LeavePolicy>> getMyPolicies(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        User currentUser = userRepository.findById(userDetails.getId()).orElse(null);
        if (currentUser == null) {
            return ResponseEntity.ok(java.util.Collections.emptyList());
        }

        List<com.leavemanagement.model.LeavePolicy> activePolicies = leavePolicyRepository.findAll().stream()
                .filter(p -> p.getIsActive() == null
                        || (p.getIsActive() && !"ARCHIVED".equalsIgnoreCase(p.getPolicyStatus())))
                .filter(p -> leaveService.isPolicyApplicableToUser(p, currentUser))
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(activePolicies);
    }

    @GetMapping("/manager/to-approve")
    public ResponseEntity<List<TimeOffResponseDTO>> getManagerLeavesToApprove(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getLeavesToApproveByManager(userDetails.getId()));
    }

    @GetMapping("/hr/to-approve")
    public ResponseEntity<List<TimeOffResponseDTO>> getHRLeavesToApprove(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getLeavesToApproveByHR(userDetails.getId()));
    }

    @GetMapping("/admin/to-approve")
    public ResponseEntity<List<TimeOffResponseDTO>> getAdminLeavesToApprove(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getLeavesToApproveByAdmin(userDetails.getId()));
    }

    @GetMapping("/pending-approvals")
    public ResponseEntity<List<TimeOffResponseDTO>> getPendingApprovals(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        boolean isAdmin = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_HR_ADMIN"));
        boolean isHR = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_HR"));
        boolean isManager = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_MANAGER"));

        List<TimeOffResponseDTO> results = new java.util.ArrayList<>();
        java.util.Set<Long> ids = new java.util.HashSet<>();

        if (isAdmin) {
            for (TimeOffResponseDTO dto : leaveService.getLeavesToApproveByAdmin(userDetails.getId())) {
                if (ids.add(dto.getId()))
                    results.add(dto);
            }
        }
        if (isHR) {
            for (TimeOffResponseDTO dto : leaveService.getLeavesToApproveByHR(userDetails.getId())) {
                if (ids.add(dto.getId()))
                    results.add(dto);
            }
        }
        if (isManager) {
            for (TimeOffResponseDTO dto : leaveService.getLeavesToApproveByManager(userDetails.getId())) {
                if (ids.add(dto.getId()))
                    results.add(dto);
            }
        }

        return ResponseEntity.ok(results);
    }

    @PutMapping("/{leaveId}/process")
    public ResponseEntity<TimeOffResponseDTO> processLeave(@AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long leaveId,
            @RequestBody Map<String, String> body) {
        String action = body.get("action"); // APPROVE or REJECT
        return ResponseEntity.ok(leaveService.processLeaveRequest(userDetails.getId(), leaveId, action));
    }

    @GetMapping("/history/my")
    public ResponseEntity<List<TimeOffResponseDTO>> getMyLeaveHistory(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getMyLeaves(userDetails.getId()));
    }

    @GetMapping("/history/team")
    public ResponseEntity<List<TimeOffResponseDTO>> getTeamLeaveHistory(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getDirectReporteesLeavesHistory(userDetails.getId()));
    }

    @GetMapping("/history/organization")
    public ResponseEntity<List<TimeOffResponseDTO>> getOrganizationLeaveHistory(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getAllLeavesHistory());
    }

    @GetMapping("/history")
    public ResponseEntity<List<TimeOffResponseDTO>> getLeaveHistory(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        boolean isHR = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_HR") || a.getAuthority().equals("ROLE_HR_ADMIN"));
        boolean isManager = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_MANAGER"));

        if (isHR) {
            return ResponseEntity.ok(leaveService.getAllLeavesHistory());
        } else if (isManager) {
            return ResponseEntity.ok(leaveService.getDirectReporteesLeavesHistory(userDetails.getId()));
        } else {
            return ResponseEntity.ok(leaveService.getMyLeaves(userDetails.getId()));
        }
    }

    @GetMapping("/history/user/{userId}")
    public ResponseEntity<List<TimeOffResponseDTO>> getUserLeaveHistory(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long userId) {
        boolean isHR = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_HR") || a.getAuthority().equals("ROLE_HR_ADMIN"));
        boolean isManager = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_MANAGER"));

        if (isHR || isManager || userDetails.getId().equals(userId)) {
            return ResponseEntity.ok(leaveService.getUserLeavesHistory(userId));
        }
        throw new RuntimeException("Access denied to view this user's leave history.");
    }

    @GetMapping("/team-members")
    public ResponseEntity<List<com.leavemanagement.payload.UserSummaryDTO>> getTeamMembers(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getDirectReportees(userDetails.getId()));
    }

    @GetMapping("/employees")
    public ResponseEntity<List<com.leavemanagement.payload.UserSummaryDTO>> getAllEmployees() {
        return ResponseEntity.ok(leaveService.getAllEmployeesSummary());
    }

    @PutMapping("/{leaveId}/withdraw")
    public ResponseEntity<TimeOffResponseDTO> withdrawLeave(@AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long leaveId) {
        return ResponseEntity.ok(leaveService.withdrawLeave(userDetails.getId(), leaveId));
    }

    @PutMapping("/{leaveId}/extend")
    public ResponseEntity<TimeOffResponseDTO> extendLeave(@AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long leaveId,
            @RequestBody Map<String, String> body) {
        String newEndDateStr = body.get("newEndDate");
        String reason = body.get("reason");
        java.time.LocalDate newEndDate = java.time.LocalDate.parse(newEndDateStr);
        return ResponseEntity.ok(leaveService.extendLeave(userDetails.getId(), leaveId, newEndDate, reason));
    }
}
