package com.leavemanagement.payload;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
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
}
