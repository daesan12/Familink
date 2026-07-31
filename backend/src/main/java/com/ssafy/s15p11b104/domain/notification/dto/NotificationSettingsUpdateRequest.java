package com.ssafy.s15p11b104.domain.notification.dto;

import java.util.List;

import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record NotificationSettingsUpdateRequest(
	@NotNull @Size(min = 7, max = 7) List<@NotNull @Valid Setting> settings
) {

	public record Setting(
		@NotNull NotificationType notificationType,
		@NotNull Boolean enabled
	) {
	}
}
