package com.leavemanagement.controller;

import com.leavemanagement.model.LeaveRequest;
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

    public LeaveController(LeaveService leaveService) {
        this.leaveService = leaveService;
    }

    @PostMapping("/apply")
    public ResponseEntity<?> applyLeave(@AuthenticationPrincipal UserDetailsImpl userDetails, 
                                        @RequestBody LeaveRequest request) {
        LeaveRequest savedRequest = leaveService.applyLeave(userDetails.getId(), request);
        return ResponseEntity.ok(savedRequest);
    }

    @GetMapping("/my-leaves")
    public ResponseEntity<List<LeaveRequest>> getMyLeaves(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getMyLeaves(userDetails.getId()));
    }

    @GetMapping("/to-approve")
    public ResponseEntity<List<LeaveRequest>> getLeavesToApprove(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        return ResponseEntity.ok(leaveService.getLeavesToApprove(userDetails.getId()));
    }

    @PutMapping("/{leaveId}/process")
    public ResponseEntity<?> processLeave(@AuthenticationPrincipal UserDetailsImpl userDetails,
                                          @PathVariable Long leaveId,
                                          @RequestBody Map<String, String> body) {
        String status = body.get("status");
        LeaveRequest processedLeave = leaveService.processLeaveRequest(userDetails.getId(), leaveId, status);
        return ResponseEntity.ok(processedLeave);
    }
}
