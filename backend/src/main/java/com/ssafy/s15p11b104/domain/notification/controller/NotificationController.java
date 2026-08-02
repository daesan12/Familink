package com.ssafy.s15p11b104.domain.notification.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.notification.dto.NotificationListResponse;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationReadAllResponse;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationReadResponse;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationUnreadCountResponse;
import com.ssafy.s15p11b104.domain.notification.service.NotificationService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;

@Validated
@RestController
@RequestMapping("/notifications")
public class NotificationController {

	private static final String UNREAD_COUNT_MESSAGE = "읽지 않은 알림 개수 조회 성공";
	private static final String LIST_MESSAGE = "알림 목록 조회 성공";
	private static final String READ_MESSAGE = "알림 읽음 처리 성공";
	private static final String READ_ALL_MESSAGE = "전체 알림 읽음 처리 성공";

	private final NotificationService notificationService;

	public NotificationController(NotificationService notificationService) {
		this.notificationService = notificationService;
	}

	@GetMapping("/unread-count")
	public ApiResponse<NotificationUnreadCountResponse> getUnreadCount(
		@AuthenticationPrincipal AuthenticatedUser user
	) {
		return ApiResponse.success(
			UNREAD_COUNT_MESSAGE,
			notificationService.getUnreadCount(user.id()));
	}

	@GetMapping
	public ApiResponse<NotificationListResponse> getNotifications(
		@AuthenticationPrincipal AuthenticatedUser user,
		@RequestParam(defaultValue = "0") @Min(0) int page,
		@RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
		@RequestParam(required = false) String sort
	) {
		if (sort != null) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		return ApiResponse.success(
			LIST_MESSAGE,
			notificationService.getNotifications(user.id(), page, size));
	}

	@PatchMapping("/{notificationId}/read")
	public ApiResponse<NotificationReadResponse> markRead(
		@AuthenticationPrincipal AuthenticatedUser user,
		@PathVariable @Positive Long notificationId
	) {
		return ApiResponse.success(
			READ_MESSAGE,
			notificationService.markRead(user.id(), notificationId));
	}

	@PatchMapping("/read-all")
	public ApiResponse<NotificationReadAllResponse> markAllRead(
		@AuthenticationPrincipal AuthenticatedUser user
	) {
		return ApiResponse.success(
			READ_ALL_MESSAGE,
			notificationService.markAllRead(user.id()));
	}
}
