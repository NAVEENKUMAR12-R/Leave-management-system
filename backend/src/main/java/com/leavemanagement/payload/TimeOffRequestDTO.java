package com.leavemanagement.payload;

import lombok.Data;
import java.time.LocalDate;

@Data
public class TimeOffRequestDTO {
    private String timeOffType;
    private LocalDate startDate;
    private LocalDate endDate;
    private String reason;
    private Boolean isCompanySponsored;
}
