package com.leavemanagement.payload;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LeaveBalanceDTO {
    private Long id;
    private String leaveType;
    private Double totalLeaves;
    private Double usedLeaves;
    private Double accruedLeaves;
    private Double availableLeaves;
    private Double accrualRate;
    private String accrualFrequency;

    public LeaveBalanceDTO(Long id, String leaveType, Double totalLeaves, Double usedLeaves) {
        this.id = id;
        this.leaveType = leaveType;
        this.totalLeaves = totalLeaves;
        this.usedLeaves = usedLeaves;
        this.accruedLeaves = totalLeaves;
        this.availableLeaves = Math.max(0.0, totalLeaves - (usedLeaves != null ? usedLeaves : 0.0));
        this.accrualRate = 1.0;
        this.accrualFrequency = "ANNUAL";
    }
}
