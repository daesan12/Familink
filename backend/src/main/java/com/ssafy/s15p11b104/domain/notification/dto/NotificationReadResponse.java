package com.ssafy.s15p11b104.domain.notification.dto;

import java.time.Instant;

public record NotificationReadResponse(Long id, Instant readAt) {
}
