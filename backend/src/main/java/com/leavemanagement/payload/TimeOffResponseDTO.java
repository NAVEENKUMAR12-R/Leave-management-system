package com.leavemanagement.payload;

import lombok.Data;
import java.time.LocalDate;

@Data
public class TimeOffResponseDTO {
    private Long id;
    private String workerId;
    private String workerName;
    private String timeOffType;
    private LocalDate startDate;
    private LocalDate endDate;
    private Double dailyQuantity;
    private Double totalQuantity;
    private String routingStatus;
    private Boolean isCompanySponsored;
    private String payStatus; // "COMPANY_SPONSORED", "UNPAID_LEAVE_OF_ABSENCE"
    private Boolean salaryCredited;
    private String payStatusLabel; // "Company Sponsored (Salary Credited)" vs "Unpaid Leave of Absence (No Salary)"
    private String reason;
}

