package com.leavemanagement.service;

import com.leavemanagement.model.Holiday;
import com.leavemanagement.repository.HolidayRepository;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class CalendarService {

    private final HolidayRepository holidayRepository;

    public CalendarService(HolidayRepository holidayRepository) {
        this.holidayRepository = holidayRepository;
    }

    public List<Holiday> getHolidays(LocalDate startDate, LocalDate endDate) {
        return holidayRepository.findByDateBetween(startDate, endDate);
    }

    public double calculateWorkingDays(LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null || startDate.isAfter(endDate)) {
            return 0;
        }

        List<LocalDate> holidays = getHolidays(startDate, endDate).stream()
                .map(Holiday::getDate)
                .collect(Collectors.toList());

        long daysBetween = ChronoUnit.DAYS.between(startDate, endDate) + 1;
        
        return Stream.iterate(startDate, d -> d.plusDays(1))
                .limit(daysBetween)
                .filter(d -> d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY)
                .filter(d -> !holidays.contains(d))
                .count();
    }
}
