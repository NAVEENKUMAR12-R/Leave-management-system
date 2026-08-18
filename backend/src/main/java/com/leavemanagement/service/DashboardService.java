package com.leavemanagement.service;

import com.leavemanagement.model.LeaveRequest;
import com.leavemanagement.model.User;
import com.leavemanagement.payload.DashboardStatsDTO;
import com.leavemanagement.repository.LeaveRequestRepository;
import com.leavemanagement.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class DashboardService {
    
    private final UserRepository userRepository;
    private final LeaveRequestRepository leaveRequestRepository;

    public DashboardService(UserRepository userRepository, LeaveRequestRepository leaveRequestRepository) {
        this.userRepository = userRepository;
        this.leaveRequestRepository = leaveRequestRepository;
    }

    public DashboardStatsDTO getStatsForDate(LocalDate date, Long managerId, boolean isHR) {
        List<User> relevantUsers;
        if (isHR) {
            relevantUsers = userRepository.findAll();
        } else {
            relevantUsers = userRepository.findByManagerId(managerId);
        }

        List<LeaveRequest> allApprovedLeaves = leaveRequestRepository.findByStatus("APPROVED");

        List<User> usersOnLeave = relevantUsers.stream()
            .filter(u -> allApprovedLeaves.stream().anyMatch(lr -> 
                lr.getApplicant().getId().equals(u.getId()) &&
                !date.isBefore(lr.getStartDate()) && !date.isAfter(lr.getEndDate())
            ))
            .collect(Collectors.toList());

        DashboardStatsDTO stats = new DashboardStatsDTO();
        stats.setTotalEmployees(relevantUsers.size());
        stats.setEmployeesOnLeave(usersOnLeave.size());
        stats.setEmployeesPresent(relevantUsers.size() - usersOnLeave.size());
        stats.setOnLeaveNames(usersOnLeave.stream().map(User::getName).collect(Collectors.toList()));

        return stats;
    }
}
