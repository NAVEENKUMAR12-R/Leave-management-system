package com.leavemanagement.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class SseEmitterService {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter createEmitter(Long userId) {
        // 30 minute timeout
        SseEmitter emitter = new SseEmitter(1800000L);

        this.emitters.add(emitter);

        emitter.onCompletion(() -> this.emitters.remove(emitter));
        emitter.onTimeout(() -> {
            emitter.complete();
            this.emitters.remove(emitter);
        });
        emitter.onError(e -> {
            emitter.complete();
            this.emitters.remove(emitter);
        });

        // Send initial connection event
        try {
            emitter.send(SseEmitter.event()
                    .name("CONNECTED")
                    .data("{\"status\":\"CONNECTED\",\"userId\":" + userId + "}"));
        } catch (IOException e) {
            this.emitters.remove(emitter);
        }

        return emitter;
    }

    public void broadcast(String eventType, Object payload) {
        List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();

        for (SseEmitter emitter : this.emitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name(eventType)
                        .data(payload));
            } catch (Exception e) {
                deadEmitters.add(emitter);
            }
        }

        this.emitters.removeAll(deadEmitters);
    }

    @Scheduled(fixedRate = 25000)
    public void sendHeartbeat() {
        broadcast("HEARTBEAT", "{\"ping\":true}");
    }
}
