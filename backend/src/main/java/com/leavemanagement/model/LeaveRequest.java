package com.leavemanagement.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDate;

@Entity
@Table(name = "leave_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LeaveRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "applicant_id", nullable = false)
    private User applicant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manager_approver_id")
    private User managerApprover;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hr_approver_id")
    private User hrApprover;

    private LocalDate startDate;
    
    private LocalDate endDate;
    
    private Double totalDays;
    
    private String leaveType; // SICK, CASUAL, ANNUAL, UNPAID

    private String status; // PENDING_MANAGER, PENDING_HR, APPROVED, REJECTED, WITHDRAWN

    private String reason;
}
