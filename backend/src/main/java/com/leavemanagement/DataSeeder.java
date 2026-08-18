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
            u.getRoles().add(new UserRole(null, u, RoleName.EMPLOYEE));
            u.getRoles().add(new UserRole(null, u, RoleName.HR));
            u.getRoles().add(new UserRole(null, u, RoleName.HR_ADMIN));
            return userRepository.save(u);
        });

        // 2. Create or get Sarah (Manager + HR)
        User sarah = userRepository.findByEmail("sarah@example.com").orElseGet(() -> {
            User u = new User();
            u.setName("Sarah Jenkins");
            u.setEmail("sarah@example.com");
            u.setPassword(commonPassword);
            u.getRoles().add(new UserRole(null, u, RoleName.EMPLOYEE));
            u.getRoles().add(new UserRole(null, u, RoleName.MANAGER));
            u.getRoles().add(new UserRole(null, u, RoleName.HR));
            return userRepository.save(u);
        });

        // 3. Create or get John (Manager + Employee, reports to Sarah)
        User john = userRepository.findByEmail("john@example.com").orElseGet(() -> {
            User u = new User();
            u.setName("John Smith");
            u.setEmail("john@example.com");
            u.setPassword(commonPassword);
            u.setManager(sarah);
            u.getRoles().add(new UserRole(null, u, RoleName.EMPLOYEE));
            u.getRoles().add(new UserRole(null, u, RoleName.MANAGER));
            return userRepository.save(u);
        });

        // 4. Create or get Alice and Bob (Employees, report to John)
        User alice = userRepository.findByEmail("alice@example.com").orElseGet(() -> {
            User u = new User();
            u.setName("Alice Cooper");
            u.setEmail("alice@example.com");
            u.setPassword(commonPassword);
            u.setManager(john);
            u.getRoles().add(new UserRole(null, u, RoleName.EMPLOYEE));
            return userRepository.save(u);
        });

        User bob = userRepository.findByEmail("bob@example.com").orElseGet(() -> {
            User u = new User();
            u.setName("Bob Dylan");
            u.setEmail("bob@example.com");
            u.setPassword(commonPassword);
            u.setManager(john);
            u.getRoles().add(new UserRole(null, u, RoleName.EMPLOYEE));
            return userRepository.save(u);
        });

        // Seed Default Leave Policies if none exist
        if (leavePolicyRepository.count() == 0) {
            LeavePolicy annual = new LeavePolicy();
            annual.setPolicyName("Global Standard Annual Leave");
            annual.setLeaveType("ANNUAL");
            annual.setEffectiveDate(LocalDate.of(2026, 1, 1));
            annual.setDescription("Standard annual paid leave with rollover support.");
            annual.setEmployeeType("ALL");
            annual.setRegion("Global");
            annual.setTenureMonths(0);
            annual.setDepartment("All Departments");
            annual.setGradeLevel("All Grades");
            annual.setAccrualRate(1.67);
            annual.setAccrualFrequency("MONTHLY");
            annual.setDefaultDays(20.0);
            annual.setAllowNegativeBalance(false);
            annual.setMaxNegativeLimit(0.0);
            annual.setIsCarryForwardAllowed(true);
            annual.setMaxCarryForwardDays(5.0);
            annual.setExpirationMonths(6);
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
            sick.setAccrualRate(0.83);
            sick.setAccrualFrequency("MONTHLY");
            sick.setDefaultDays(10.0);
            sick.setAllowNegativeBalance(true);
            sick.setMaxNegativeLimit(3.0);
            sick.setIsCarryForwardAllowed(false);
            sick.setMaxCarryForwardDays(0.0);
            sick.setExpirationMonths(0);
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
            casual.setAccrualRate(7.0);
            casual.setAccrualFrequency("ANNUAL");
            casual.setDefaultDays(7.0);
            casual.setAllowNegativeBalance(false);
            casual.setMaxNegativeLimit(0.0);
            casual.setIsCarryForwardAllowed(false);
            casual.setMaxCarryForwardDays(0.0);
            casual.setExpirationMonths(0);
            casual.setApprovalStep1("MANAGER");
            casual.setApprovalStep2("HR");
            casual.setApprovalStep3("SKIP");
            casual.setPreventOverlapWith("ALL");
            casual.setPreventExceedingLimit(true);
            casual.setAllowSpecialExceptions(false);
            casual.setReportFrequency("ANNUAL");
            leavePolicyRepository.save(casual);
        }

        // Seed Leave Balances for each user if missing
        User[] allUsers = { admin, sarah, john, alice, bob };
        String[] types = { "ANNUAL", "SICK", "CASUAL", "EARNED" };
        double[] quotas = { 20.0, 10.0, 7.0, 15.0 };

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
