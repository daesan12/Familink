package com.ssafy.s15p11b104.domain.notification.dto;

import java.util.List;

import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;

public record NotificationSettingsResponse(List<Setting> settings) {

	public record Setting(NotificationType notificationType, boolean enabled) {
	}
}
