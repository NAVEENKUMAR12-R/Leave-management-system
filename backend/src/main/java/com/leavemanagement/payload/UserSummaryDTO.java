package com.leavemanagement.payload;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserSummaryDTO {
    private Long id;
    private String name;
    private String email;
    private List<String> roles;
    private String managerName;
    private Long managerId;
    private String department;
    private String designation;
    private String employeeType;
    private String region;
    private LocalDate hireDate;

    // Leave & PTO statistics
    private Double totalPtoAllocated;
    private Double totalPtoUsed;
    private Double totalPtoAvailable;
    private Double totalUnpaidDays;
    private List<LeaveBalanceDTO> leaveBalances;

    public UserSummaryDTO(Long id, String name, String email) {
        this.id = id;
        this.name = name;
        this.email = email;
    }

    public UserSummaryDTO(Long id, String name, String email, List<String> roles, String managerName) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.roles = roles;
        this.managerName = managerName;
    }
}
