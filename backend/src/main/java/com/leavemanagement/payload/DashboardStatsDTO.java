package com.leavemanagement.payload;

import lombok.Data;
import java.util.List;

@Data
public class DashboardStatsDTO {
    private long totalEmployees;
    private long employeesOnLeave;
    private long employeesPresent;
    private List<String> onLeaveNames;
}
