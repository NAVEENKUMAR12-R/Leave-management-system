package com.leavemanagement.controller;

import com.leavemanagement.model.LeaveBalance;
import com.leavemanagement.model.LeavePolicy;
import com.leavemanagement.model.RoleName;
import com.leavemanagement.model.User;
import com.leavemanagement.model.UserRole;
import com.leavemanagement.payload.OnboardEmployeeDTO;
import com.leavemanagement.payload.UserSummaryDTO;
import com.leavemanagement.repository.LeaveBalanceRepository;
import com.leavemanagement.repository.LeavePolicyRepository;
import com.leavemanagement.repository.UserRepository;
import com.leavemanagement.service.LeaveService;
import com.leavemanagement.service.SseEmitterService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/admin/employees")
public class AdminEmployeeController {

    private final UserRepository userRepository;
    private final LeaveBalanceRepository leaveBalanceRepository;
    private final LeavePolicyRepository leavePolicyRepository;
    private final LeaveService leaveService;
    private final PasswordEncoder passwordEncoder;
    private final SseEmitterService sseEmitterService;

    public AdminEmployeeController(UserRepository userRepository,
                                   LeaveBalanceRepository leaveBalanceRepository,
                                   LeavePolicyRepository leavePolicyRepository,
                                   LeaveService leaveService,
                                   PasswordEncoder passwordEncoder,
                                   SseEmitterService sseEmitterService) {
        this.userRepository = userRepository;
        this.leaveBalanceRepository = leaveBalanceRepository;
        this.leavePolicyRepository = leavePolicyRepository;
        this.leaveService = leaveService;
        this.passwordEncoder = passwordEncoder;
        this.sseEmitterService = sseEmitterService;
    }

    @GetMapping
    @PreAuthorize("hasRole('HR_ADMIN') or hasRole('HR')")
    public ResponseEntity<List<UserSummaryDTO>> getAllEmployees() {
        List<UserSummaryDTO> dtos = userRepository.findAll().stream()
                .map(this::mapToSummaryDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/managers")
    @PreAuthorize("hasRole('HR_ADMIN') or hasRole('HR')")
    public ResponseEntity<List<UserSummaryDTO>> getPotentialManagers() {
        List<UserSummaryDTO> managers = userRepository.findAll().stream()
                .filter(u -> u.getRoles().stream().anyMatch(r ->
                        r.getRole() == RoleName.MANAGER ||
                        r.getRole() == RoleName.HR ||
                        r.getRole() == RoleName.HR_ADMIN))
                .map(this::mapToSummaryDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(managers);
    }

    @PostMapping("/onboard")
    @PreAuthorize("hasRole('HR_ADMIN') or hasRole('HR')")
    @Transactional
    public ResponseEntity<UserSummaryDTO> onboardEmployee(@RequestBody OnboardEmployeeDTO dto) {
        if (dto.getEmail() == null || dto.getEmail().trim().isEmpty()) {
            throw new RuntimeException("Email address is required.");
        }
        if (dto.getName() == null || dto.getName().trim().isEmpty()) {
            throw new RuntimeException("Full name is required.");
        }

        String email = dto.getEmail().trim().toLowerCase();
        if (userRepository.findByEmail(email).isPresent()) {
            throw new RuntimeException("An employee with email '" + email + "' already exists.");
        }

        User user = new User();
        user.setName(dto.getName().trim());
        user.setEmail(email);

        String rawPassword = (dto.getPassword() != null && !dto.getPassword().trim().isEmpty())
                ? dto.getPassword().trim()
                : "Password@123";
        user.setPassword(passwordEncoder.encode(rawPassword));

        user.setDepartment(dto.getDepartment() != null ? dto.getDepartment().trim() : "General");
        user.setDesignation(dto.getDesignation() != null ? dto.getDesignation().trim() : "Team Member");
        user.setEmployeeType(dto.getEmployeeType() != null ? dto.getEmployeeType().trim() : "FULL_TIME");
        user.setHireDate(dto.getHireDate() != null ? dto.getHireDate() : LocalDate.now());

        // Assign Manager
        if (dto.getManagerId() != null) {
            User manager = userRepository.findById(dto.getManagerId())
                    .orElse(null);
            user.setManager(manager);
        }

        // Assign Roles
        List<UserRole> userRoles = new ArrayList<>();
        // Always assign EMPLOYEE base role
        userRoles.add(new UserRole(null, user, RoleName.EMPLOYEE));

        if (dto.getRoles() != null) {
            for (String r : dto.getRoles()) {
                String roleClean = r.toUpperCase().replace("ROLE_", "");
                try {
                    RoleName rn = RoleName.valueOf(roleClean);
                    if (rn != RoleName.EMPLOYEE && userRoles.stream().noneMatch(ur -> ur.getRole() == rn)) {
                        userRoles.add(new UserRole(null, user, rn));
                    }
                } catch (IllegalArgumentException ignored) {}
            }
        }
        user.setRoles(userRoles);

        User savedUser = userRepository.save(user);

        // Auto-provision leave balances based on active applicable policies and join-date proration
        Set<String> assignedRoleNames = savedUser.getRoles().stream()
                .map(r -> r.getRole().name())
                .collect(Collectors.toSet());

        List<LeavePolicy> activePolicies = leavePolicyRepository.findAll().stream()
                .filter(p -> p.getIsActive() == null || (p.getIsActive() && !"ARCHIVED".equalsIgnoreCase(p.getPolicyStatus())))
                .collect(Collectors.toList());

        for (LeavePolicy policy : activePolicies) {
            double quota = policy.getDefaultDays() != null ? policy.getDefaultDays() : 10.0;

            // Apply join date proration if policy is prorated
            if (Boolean.TRUE.equals(policy.getIsProrated()) && savedUser.getHireDate() != null) {
                quota = leaveService.calculateProratedQuota(
                        policy,
                        savedUser.getHireDate(),
                        policy.getEffectiveDate(),
                        policy.getEndDate()
                );
            }

            LeaveBalance balance = new LeaveBalance();
            balance.setUser(savedUser);
            balance.setLeaveType(policy.getLeaveType().toUpperCase());
            balance.setTotalLeaves(quota);
            balance.setUsedLeaves(0.0);
            leaveBalanceRepository.save(balance);
        }

        sseEmitterService.broadcast("POLICY_UPDATE", null);

        return ResponseEntity.ok(mapToSummaryDTO(savedUser));
    }

    private UserSummaryDTO mapToSummaryDTO(User u) {
        return leaveService.getUserSummaryWithLeaveStats(u);
    }
}
