package com.leavemanagement.controller;

import com.leavemanagement.security.UserDetailsImpl;
import com.leavemanagement.service.SseEmitterService;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/events")
public class EventController {

    private final SseEmitterService sseEmitterService;

    public EventController(SseEmitterService sseEmitterService) {
        this.sseEmitterService = sseEmitterService;
    }

    @GetMapping(value = "/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        Long userId = userDetails != null ? userDetails.getId() : 0L;
        return sseEmitterService.createEmitter(userId);
    }
}
