package com.leavemanagement.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDate;

@Entity
@Table(name = "leave_policies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LeavePolicy {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 1. Basic & Policy Info
    @Column(nullable = false)
    private String policyName;

    @Column(nullable = false)
    private String leaveType; // ANNUAL, SICK, CASUAL, EARNED, MATERNITY, PATERNITY, UNPAID

    private LocalDate effectiveDate; // Period Start Date
    private LocalDate endDate; // Period End Date
    
    private Boolean isActive = true;
    private String policyStatus = "ACTIVE"; // ACTIVE, EXPIRED, ARCHIVED
    private Long restartedFromId; // If renewed from a past policy
    
    @Column(length = 1000)
    private String description;

    // 2. Dynamic Eligibility Combinations
    private String eligibleRole = "ALL"; // ALL, EMPLOYEE, MANAGER, HR, HR_ADMIN, EMPLOYEE_MANAGER
    private String employeeType; // FULL_TIME, PART_TIME, CONTRACT, ALL
    private String region; // Global, North America, APAC, EMEA, India
    private Integer tenureMonths; // Min tenure in months
    private String department; // All Departments, Engineering, HR, Sales, etc.
    private String gradeLevel; // All Grades, Executive, Senior, Associate, etc.

    // 3. Accrual & Proration Rules (Editable anytime)
    private Double accrualRate; // e.g. 1.67 days/month or 20 days/year
    private String accrualFrequency; // MONTHLY, ANNUAL
    private Double defaultDays; // Annual baseline days
    private Boolean allowNegativeBalance; // true/false
    private Double maxNegativeLimit; // Limit if negative is allowed

    // Proration Rules
    private Boolean isProrated = true; // Enable/Disable Proration
    private String prorationBasis = "HIRE_DATE"; // HIRE_DATE, FTE_HOURS, POLICY_PERIOD
    private String prorationRounding = "ROUND_HALF"; // ROUND_HALF, ROUND_UP, ROUND_DOWN, EXACT

    // 4. Carryover & Expiration Rules
    private Boolean isCarryForwardAllowed;
    private Double maxCarryForwardDays;
    private Integer expirationMonths; // Expiration in months (e.g. 3, 6, 12)

    // 5. Configurable Approval Workflow Chain
    private String approvalStep1; // MANAGER, HR, AUTO_APPROVE
    private String approvalStep2; // HR, ADMIN, SKIP
    private String approvalStep3; // ADMIN, SKIP

    // 6. Validation Rules
    private String preventOverlapWith; // Categories to prevent overlap with
    private Boolean preventExceedingLimit;
    private Boolean allowSpecialExceptions;

    // 7. Reporting & Monitoring
    private String reportFrequency; // MONTHLY, QUARTERLY, ANNUAL
}
