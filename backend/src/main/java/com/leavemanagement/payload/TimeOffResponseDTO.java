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
}

