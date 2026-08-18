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

    public AdminController(LeavePolicyRepository leavePolicyRepository) {
        this.leavePolicyRepository = leavePolicyRepository;
    }

    @GetMapping
    @PreAuthorize("hasRole('HR_ADMIN')")
    public ResponseEntity<List<LeavePolicy>> getPolicies() {
        return ResponseEntity.ok(leavePolicyRepository.findAll());
    }

    @PostMapping
    @PreAuthorize("hasRole('HR_ADMIN')")
    public ResponseEntity<LeavePolicy> createOrUpdatePolicy(@RequestBody LeavePolicy policy) {
        return ResponseEntity.ok(leavePolicyRepository.save(policy));
    }
}

