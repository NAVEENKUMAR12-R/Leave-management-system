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

    public LeaveController(LeaveService leaveService, LeaveBalanceRepository leaveBalanceRepository) {
        this.leaveService = leaveService;
        this.leaveBalanceRepository = leaveBalanceRepository;
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

    @GetMapping("/manager/to-approve")
    public ResponseEntity<List<TimeOffResponseDTO>> getManagerLeavesToApprove(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getLeavesToApproveByManager(userDetails.getId()));
    }

    @GetMapping("/hr/to-approve")
    public ResponseEntity<List<TimeOffResponseDTO>> getHRLeavesToApprove() {
        return ResponseEntity.ok(leaveService.getLeavesToApproveByHR());
    }

    @PutMapping("/{leaveId}/process")
    public ResponseEntity<TimeOffResponseDTO> processLeave(@AuthenticationPrincipal UserDetailsImpl userDetails,
                                          @PathVariable Long leaveId,
                                          @RequestBody Map<String, String> body) {
        String action = body.get("action"); // APPROVE or REJECT
        return ResponseEntity.ok(leaveService.processLeaveRequest(userDetails.getId(), leaveId, action));
    }
    
    @PutMapping("/{leaveId}/withdraw")
    public ResponseEntity<TimeOffResponseDTO> withdrawLeave(@AuthenticationPrincipal UserDetailsImpl userDetails,
                                          @PathVariable Long leaveId) {
        return ResponseEntity.ok(leaveService.withdrawLeave(userDetails.getId(), leaveId));
    }
}

