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
            leavePolicyRepository.save(new LeavePolicy(null, "ANNUAL", 20.0, true, 5.0));
            leavePolicyRepository.save(new LeavePolicy(null, "SICK", 10.0, false, 0.0));
            leavePolicyRepository.save(new LeavePolicy(null, "CASUAL", 7.0, false, 0.0));
        }

        // Seed Leave Balances for each user if missing
        User[] allUsers = { admin, sarah, john, alice, bob };
        for (User u : allUsers) {
            if (leaveBalanceRepository.findByUserId(u.getId()).isEmpty()) {
                leaveBalanceRepository.save(new LeaveBalance(null, u, "ANNUAL", 20.0, 0.0));
                leaveBalanceRepository.save(new LeaveBalance(null, u, "SICK", 10.0, 0.0));
                leaveBalanceRepository.save(new LeaveBalance(null, u, "CASUAL", 7.0, 0.0));
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
