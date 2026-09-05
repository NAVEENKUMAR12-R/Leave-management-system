package com.leavemanagement;

import com.leavemanagement.model.*;
import com.leavemanagement.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Component
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final LeaveBalanceRepository leaveBalanceRepository;
    private final LeavePolicyRepository leavePolicyRepository;
    private final HolidayRepository holidayRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(UserRepository userRepository,
                      LeaveBalanceRepository leaveBalanceRepository,
                      LeavePolicyRepository leavePolicyRepository,
                      HolidayRepository holidayRepository,
                      PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.leaveBalanceRepository = leaveBalanceRepository;
        this.leavePolicyRepository = leavePolicyRepository;
        this.holidayRepository = holidayRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        String commonPassword = passwordEncoder.encode("password");

        // 1. Create or get HR Admin
        User admin = userRepository.findByEmail("admin@example.com").orElseGet(() -> {
            User u = new User();
            u.setName("Admin HR");
            u.setEmail("admin@example.com");
            u.setPassword(commonPassword);
            u.setDepartment("Human Resources");
            u.setDesignation("HR Director");
            u.setEmployeeType("FULL_TIME");
            u.setRegion("North America");
            u.setHireDate(LocalDate.of(2024, 1, 15));
            u.getRoles().add(new UserRole(null, u, RoleName.EMPLOYEE));
            u.getRoles().add(new UserRole(null, u, RoleName.HR));
            u.getRoles().add(new UserRole(null, u, RoleName.HR_ADMIN));
            return userRepository.save(u);
        });
        if (admin.getRegion() == null) {
            admin.setRegion("North America");
            admin.setDepartment("Human Resources");
            admin.setDesignation("HR Director");
            admin.setEmployeeType("FULL_TIME");
            admin.setHireDate(LocalDate.of(2024, 1, 15));
            userRepository.save(admin);
        }

        // 2. Create or get Sarah (Manager + HR)
        User sarah = userRepository.findByEmail("sarah@example.com").orElseGet(() -> {
            User u = new User();
            u.setName("Sarah Jenkins");
            u.setEmail("sarah@example.com");
            u.setPassword(commonPassword);
            u.setDepartment("Engineering");
            u.setDesignation("VP of Engineering");
            u.setEmployeeType("FULL_TIME");
            u.setRegion("North America");
            u.setHireDate(LocalDate.of(2024, 3, 1));
            u.getRoles().add(new UserRole(null, u, RoleName.EMPLOYEE));
            u.getRoles().add(new UserRole(null, u, RoleName.MANAGER));
            u.getRoles().add(new UserRole(null, u, RoleName.HR));
            return userRepository.save(u);
        });
        if (sarah.getRegion() == null) {
            sarah.setRegion("North America");
            sarah.setDepartment("Engineering");
            sarah.setDesignation("VP of Engineering");
            sarah.setEmployeeType("FULL_TIME");
            sarah.setHireDate(LocalDate.of(2024, 3, 1));
            userRepository.save(sarah);
        }

        // 3. Create or get John (Manager + Employee, reports to Sarah)
        User john = userRepository.findByEmail("john@example.com").orElseGet(() -> {
            User u = new User();
            u.setName("John Smith");
            u.setEmail("john@example.com");
            u.setPassword(commonPassword);
            u.setDepartment("Engineering");
            u.setDesignation("Engineering Manager");
            u.setEmployeeType("FULL_TIME");
            u.setRegion("APAC");
            u.setHireDate(LocalDate.of(2024, 6, 1));
            u.getRoles().add(new UserRole(null, u, RoleName.EMPLOYEE));
            u.getRoles().add(new UserRole(null, u, RoleName.MANAGER));
            return userRepository.save(u);
        });
        // Backfill profile fields and manager link regardless of whether just created or pre-existing
        boolean johnChanged = false;
        if (john.getRegion() == null) { john.setRegion("APAC"); johnChanged = true; }
        if (john.getDepartment() == null) { john.setDepartment("Engineering"); johnChanged = true; }
        if (john.getDesignation() == null) { john.setDesignation("Engineering Manager"); johnChanged = true; }
        if (john.getEmployeeType() == null) { john.setEmployeeType("FULL_TIME"); johnChanged = true; }
        if (john.getHireDate() == null) { john.setHireDate(LocalDate.of(2024, 6, 1)); johnChanged = true; }
        if (john.getManager() == null) { john.setManager(sarah); johnChanged = true; }
        if (johnChanged) userRepository.save(john);

        // 4. Create or get Alice and Bob (Employees, report to John)
        User alice = userRepository.findByEmail("alice@example.com").orElseGet(() -> {
            User u = new User();
            u.setName("Alice Cooper");
            u.setEmail("alice@example.com");
            u.setPassword(commonPassword);
            u.setDepartment("Engineering");
            u.setDesignation("Senior Software Engineer");
            u.setEmployeeType("FULL_TIME");
            u.setRegion("APAC");
            u.setHireDate(LocalDate.of(2025, 1, 10));
            u.getRoles().add(new UserRole(null, u, RoleName.EMPLOYEE));
            return userRepository.save(u);
        });
        // Backfill manager link and profile fields regardless of whether just created or pre-existing
        boolean aliceChanged = false;
        if (alice.getRegion() == null) { alice.setRegion("APAC"); aliceChanged = true; }
        if (alice.getDepartment() == null) { alice.setDepartment("Engineering"); aliceChanged = true; }
        if (alice.getDesignation() == null) { alice.setDesignation("Senior Software Engineer"); aliceChanged = true; }
        if (alice.getEmployeeType() == null) { alice.setEmployeeType("FULL_TIME"); aliceChanged = true; }
        if (alice.getHireDate() == null) { alice.setHireDate(LocalDate.of(2025, 1, 10)); aliceChanged = true; }
        if (alice.getManager() == null) { alice.setManager(john); aliceChanged = true; }
        if (aliceChanged) userRepository.save(alice);

        User bob = userRepository.findByEmail("bob@example.com").orElseGet(() -> {
            User u = new User();
            u.setName("Bob Dylan");
            u.setEmail("bob@example.com");
            u.setPassword(commonPassword);
            u.setDepartment("Engineering");
            u.setDesignation("QA Engineer");
            u.setEmployeeType("FULL_TIME");
            u.setRegion("EMEA");
            u.setHireDate(LocalDate.of(2025, 5, 20));
            u.getRoles().add(new UserRole(null, u, RoleName.EMPLOYEE));
            return userRepository.save(u);
        });
        // Backfill manager link and profile fields regardless of whether just created or pre-existing
        boolean bobChanged = false;
        if (bob.getRegion() == null) { bob.setRegion("EMEA"); bobChanged = true; }
        if (bob.getDepartment() == null) { bob.setDepartment("Engineering"); bobChanged = true; }
        if (bob.getDesignation() == null) { bob.setDesignation("QA Engineer"); bobChanged = true; }
        if (bob.getEmployeeType() == null) { bob.setEmployeeType("FULL_TIME"); bobChanged = true; }
        if (bob.getHireDate() == null) { bob.setHireDate(LocalDate.of(2025, 5, 20)); bobChanged = true; }
        if (bob.getManager() == null) { bob.setManager(john); bobChanged = true; }
        if (bobChanged) userRepository.save(bob);

        // Backfill region for any user in database that doesn't have one
        for (User u : userRepository.findAll()) {
            if (u.getRegion() == null || u.getRegion().trim().isEmpty()) {
                u.setRegion("Global");
                userRepository.save(u);
            }
        }

        // Seed Default Leave Policies if none exist
        if (leavePolicyRepository.count() == 0) {
            LeavePolicy annual = new LeavePolicy();
            annual.setPolicyName("Global Standard Annual Leave");
            annual.setLeaveType("ANNUAL");
            annual.setEffectiveDate(LocalDate.of(2026, 1, 1));
            annual.setDescription("Standard annual paid leave with monthly accrual.");
            annual.setEmployeeType("ALL");
            annual.setRegion("Global");
            annual.setTenureMonths(0);
            annual.setDepartment("All Departments");
            annual.setGradeLevel("All Grades");
            annual.setAccrualRate(2.0);
            annual.setAccrualFrequency("MONTHLY");
            annual.setDefaultDays(24.0);
            annual.setAllowNegativeBalance(false);
            annual.setMaxNegativeLimit(0.0);
            annual.setIsCarryForwardAllowed(true);
            annual.setMaxCarryForwardDays(5.0);
            annual.setExpirationMonths(6);
            annual.setProrationRounding("ROUND_UP");
            annual.setApprovalStep1("MANAGER");
            annual.setApprovalStep2("HR");
            annual.setApprovalStep3("SKIP");
            annual.setPreventOverlapWith("ANNUAL,SICK,CASUAL");
            annual.setPreventExceedingLimit(true);
            annual.setAllowSpecialExceptions(true);
            annual.setReportFrequency("QUARTERLY");
            leavePolicyRepository.save(annual);

            LeavePolicy sick = new LeavePolicy();
            sick.setPolicyName("Standard Sick & Wellness Leave");
            sick.setLeaveType("SICK");
            sick.setEffectiveDate(LocalDate.of(2026, 1, 1));
            sick.setDescription("Paid sick and wellness leave for health recovery.");
            sick.setEmployeeType("ALL");
            sick.setRegion("Global");
            sick.setTenureMonths(0);
            sick.setDepartment("All Departments");
            sick.setGradeLevel("All Grades");
            sick.setAccrualRate(1.0);
            sick.setAccrualFrequency("MONTHLY");
            sick.setDefaultDays(12.0);
            sick.setAllowNegativeBalance(true);
            sick.setMaxNegativeLimit(3.0);
            sick.setIsCarryForwardAllowed(false);
            sick.setMaxCarryForwardDays(0.0);
            sick.setExpirationMonths(0);
            sick.setProrationRounding("ROUND_UP");
            sick.setApprovalStep1("MANAGER");
            sick.setApprovalStep2("HR");
            sick.setApprovalStep3("SKIP");
            sick.setPreventOverlapWith("ALL");
            sick.setPreventExceedingLimit(true);
            sick.setAllowSpecialExceptions(true);
            sick.setReportFrequency("MONTHLY");
            leavePolicyRepository.save(sick);

            LeavePolicy casual = new LeavePolicy();
            casual.setPolicyName("Casual Personal Leave");
            casual.setLeaveType("CASUAL");
            casual.setEffectiveDate(LocalDate.of(2026, 1, 1));
            casual.setDescription("Short personal and urgent situational leaves.");
            casual.setEmployeeType("FULL_TIME");
            casual.setRegion("Global");
            casual.setTenureMonths(1);
            casual.setDepartment("All Departments");
            casual.setGradeLevel("All Grades");
            casual.setAccrualRate(1.0);
            casual.setAccrualFrequency("MONTHLY");
            casual.setDefaultDays(12.0);
            casual.setAllowNegativeBalance(false);
            casual.setMaxNegativeLimit(0.0);
            casual.setIsCarryForwardAllowed(false);
            casual.setMaxCarryForwardDays(0.0);
            casual.setExpirationMonths(0);
            casual.setProrationRounding("ROUND_UP");
            casual.setApprovalStep1("MANAGER");
            casual.setApprovalStep2("HR");
            casual.setApprovalStep3("SKIP");
            casual.setPreventOverlapWith("ALL");
            casual.setPreventExceedingLimit(true);
            casual.setAllowSpecialExceptions(false);
            casual.setReportFrequency("ANNUAL");
            leavePolicyRepository.save(casual);
        } else {
            // Normalize any legacy decimal values to clean whole integers
            for (LeavePolicy p : leavePolicyRepository.findAll()) {
                boolean changed = false;
                if (p.getAccrualRate() != null) {
                    double roundedRate = Math.max(1.0, Math.round(p.getAccrualRate()));
                    if (Double.compare(p.getAccrualRate(), roundedRate) != 0) {
                        p.setAccrualRate(roundedRate);
                        changed = true;
                    }
                }
                if (p.getDefaultDays() != null) {
                    double roundedDays = Math.max(1.0, Math.round(p.getDefaultDays()));
                    if (Double.compare(p.getDefaultDays(), roundedDays) != 0) {
                        p.setDefaultDays(roundedDays);
                        changed = true;
                    }
                }
                if (changed) {
                    leavePolicyRepository.save(p);
                }
            }
        }

        // Seed Leave Balances for each user if missing
        User[] allUsers = { admin, sarah, john, alice, bob };
        String[] types = { "ANNUAL", "SICK", "CASUAL", "EARNED" };
        double[] quotas = { 24.0, 12.0, 12.0, 15.0 };

        for (User u : allUsers) {
            for (int i = 0; i < types.length; i++) {
                String type = types[i];
                double quota = quotas[i];
                if (leaveBalanceRepository.findByUserIdAndLeaveType(u.getId(), type).isEmpty()) {
                    leaveBalanceRepository.save(new LeaveBalance(null, u, type, quota, 0.0));
                }
            }
        }

        // Seed 2026 Public & Company Holidays if none exist
        if (holidayRepository.count() == 0) {
            holidayRepository.save(new Holiday(null, LocalDate.of(2026, 1, 1), "New Year's Day", "PUBLIC"));
            holidayRepository.save(new Holiday(null, LocalDate.of(2026, 1, 26), "Republic Day", "PUBLIC"));
            holidayRepository.save(new Holiday(null, LocalDate.of(2026, 3, 4), "Holi Festival", "PUBLIC"));
            holidayRepository.save(new Holiday(null, LocalDate.of(2026, 5, 1), "Labor Day", "COMPANY"));
            holidayRepository.save(new Holiday(null, LocalDate.of(2026, 8, 15), "Independence Day", "PUBLIC"));
            holidayRepository.save(new Holiday(null, LocalDate.of(2026, 10, 2), "Gandhi Jayanti", "PUBLIC"));
            holidayRepository.save(new Holiday(null, LocalDate.of(2026, 11, 8), "Diwali", "PUBLIC"));
            holidayRepository.save(new Holiday(null, LocalDate.of(2026, 12, 25), "Christmas Day", "PUBLIC"));
        }

        System.out.println("Data seeding verified: Admin HR, Sarah, John, Alice, Bob, policies, balances, and holidays are present.");
    }
}
