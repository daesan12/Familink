package com.ssafy.s15p11b104.domain.notification.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.notification.dto.NotificationSettingsResponse;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationSettingsUpdateRequest;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationSettingsUpdateResponse;
import com.ssafy.s15p11b104.domain.notification.service.NotificationSettingService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/notification-settings")
public class NotificationSettingController {

	private static final String GET_MESSAGE = "푸시 알림 설정 조회 성공";
	private static final String UPDATE_MESSAGE = "푸시 알림 설정 저장 성공";

	private final NotificationSettingService notificationSettingService;

	public NotificationSettingController(NotificationSettingService notificationSettingService) {
		this.notificationSettingService = notificationSettingService;
	}

	@GetMapping
	public ApiResponse<NotificationSettingsResponse> getSettings(
		@AuthenticationPrincipal AuthenticatedUser user
	) {
		return ApiResponse.success(GET_MESSAGE, notificationSettingService.getSettings(user.id()));
	}

	@PutMapping
	public ApiResponse<NotificationSettingsUpdateResponse> updateSettings(
		@AuthenticationPrincipal AuthenticatedUser user,
		@Valid @RequestBody NotificationSettingsUpdateRequest request
	) {
		return ApiResponse.success(
			UPDATE_MESSAGE,
			notificationSettingService.updateSettings(user.id(), request));
	}
}
