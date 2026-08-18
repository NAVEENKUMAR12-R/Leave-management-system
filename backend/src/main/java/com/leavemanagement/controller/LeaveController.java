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

import java.util.List;
import java.util.Map;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/leaves")
public class LeaveController {

    private final LeaveService leaveService;
    private final LeaveBalanceRepository leaveBalanceRepository;
    private final com.leavemanagement.repository.LeavePolicyRepository leavePolicyRepository;

    public LeaveController(LeaveService leaveService,
                           LeaveBalanceRepository leaveBalanceRepository,
                           com.leavemanagement.repository.LeavePolicyRepository leavePolicyRepository) {
        this.leaveService = leaveService;
        this.leaveBalanceRepository = leaveBalanceRepository;
        this.leavePolicyRepository = leavePolicyRepository;
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
    public ResponseEntity<List<com.leavemanagement.payload.LeaveBalanceDTO>> getMyBalances(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        List<com.leavemanagement.payload.LeaveBalanceDTO> dtos = leaveBalanceRepository.findByUserId(userDetails.getId())
                .stream()
                .map(b -> new com.leavemanagement.payload.LeaveBalanceDTO(b.getId(), b.getLeaveType(), b.getTotalLeaves(), b.getUsedLeaves()))
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/my-policies")
    public ResponseEntity<List<com.leavemanagement.model.LeavePolicy>> getMyPolicies(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        List<com.leavemanagement.model.LeavePolicy> activePolicies = leavePolicyRepository.findAll().stream()
                .filter(p -> p.getIsActive() == null || (p.getIsActive() && !"ARCHIVED".equalsIgnoreCase(p.getPolicyStatus())))
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(activePolicies);
    }

    @GetMapping("/manager/to-approve")
    public ResponseEntity<List<TimeOffResponseDTO>> getManagerLeavesToApprove(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getLeavesToApproveByManager(userDetails.getId()));
    }

    @GetMapping("/hr/to-approve")
    public ResponseEntity<List<TimeOffResponseDTO>> getHRLeavesToApprove(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getLeavesToApproveByHR(userDetails.getId()));
    }

    @GetMapping("/admin/to-approve")
    public ResponseEntity<List<TimeOffResponseDTO>> getAdminLeavesToApprove(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getLeavesToApproveByAdmin(userDetails.getId()));
    }

    @GetMapping("/pending-approvals")
    public ResponseEntity<List<TimeOffResponseDTO>> getPendingApprovals(@AuthenticationPrincipal UserDetailsImpl userDetails) {
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
                if (ids.add(dto.getId())) results.add(dto);
            }
        }
        if (isHR) {
            for (TimeOffResponseDTO dto : leaveService.getLeavesToApproveByHR(userDetails.getId())) {
                if (ids.add(dto.getId())) results.add(dto);
            }
        }
        if (isManager) {
            for (TimeOffResponseDTO dto : leaveService.getLeavesToApproveByManager(userDetails.getId())) {
                if (ids.add(dto.getId())) results.add(dto);
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
    public ResponseEntity<List<TimeOffResponseDTO>> getMyLeaveHistory(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getMyLeaves(userDetails.getId()));
    }

    @GetMapping("/history/team")
    public ResponseEntity<List<TimeOffResponseDTO>> getTeamLeaveHistory(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getDirectReporteesLeavesHistory(userDetails.getId()));
    }

    @GetMapping("/history/organization")
    public ResponseEntity<List<TimeOffResponseDTO>> getOrganizationLeaveHistory(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getAllLeavesHistory());
    }

    @GetMapping("/history")
    public ResponseEntity<List<TimeOffResponseDTO>> getLeaveHistory(@AuthenticationPrincipal UserDetailsImpl userDetails) {
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
    public ResponseEntity<List<com.leavemanagement.payload.UserSummaryDTO>> getTeamMembers(@AuthenticationPrincipal UserDetailsImpl userDetails) {
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
}

