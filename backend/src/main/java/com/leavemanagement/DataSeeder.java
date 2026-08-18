package com.leavemanagement;

import com.leavemanagement.model.RoleName;
import com.leavemanagement.model.User;
import com.leavemanagement.model.UserRole;
import com.leavemanagement.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        if (userRepository.count() > 0) {
            return;
        }

        String commonPassword = passwordEncoder.encode("password");

        // 1. Create Sarah (Manager + HR)
        User sarah = new User();
        sarah.setName("Sarah");
        sarah.setEmail("sarah@example.com");
        sarah.setPassword(commonPassword);
        sarah.getRoles().add(new UserRole(null, sarah, RoleName.EMPLOYEE));
        sarah.getRoles().add(new UserRole(null, sarah, RoleName.MANAGER));
        sarah.getRoles().add(new UserRole(null, sarah, RoleName.HR));
        sarah = userRepository.save(sarah);

        // 2. Create John (Manager + Employee, reports to Sarah)
        User john = new User();
        john.setName("John");
        john.setEmail("john@example.com");
        john.setPassword(commonPassword);
        john.setManager(sarah);
        john.getRoles().add(new UserRole(null, john, RoleName.EMPLOYEE));
        john.getRoles().add(new UserRole(null, john, RoleName.MANAGER));
        john = userRepository.save(john);

        // 3. Create Alice and Bob (Employees, report to John)
        User alice = new User();
        alice.setName("Alice");
        alice.setEmail("alice@example.com");
        alice.setPassword(commonPassword);
        alice.setManager(john);
        alice.getRoles().add(new UserRole(null, alice, RoleName.EMPLOYEE));
        userRepository.save(alice);

        User bob = new User();
        bob.setName("Bob");
        bob.setEmail("bob@example.com");
        bob.setPassword(commonPassword);
        bob.setManager(john);
        bob.getRoles().add(new UserRole(null, bob, RoleName.EMPLOYEE));
        userRepository.save(bob);
        
        System.out.println("Data seeding completed. Created Sarah, John, Alice, Bob.");
    }
}
