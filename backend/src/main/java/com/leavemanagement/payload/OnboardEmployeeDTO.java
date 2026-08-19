package com.leavemanagement.payload;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OnboardEmployeeDTO {
    private String name;
    private String email;
    private String password;
    private List<String> roles; // "ROLE_EMPLOYEE", "ROLE_MANAGER", "ROLE_HR", "ROLE_HR_ADMIN"
    private Long managerId;
    private String department;
    private String designation;
    private String employeeType; // "FULL_TIME", "PART_TIME", "CONTRACTOR", "INTERN"
    private String region; // "North America", "APAC", "EMEA", "India", "Global"
    private LocalDate hireDate;
}
