package com.ssafy.s15p11b104.domain.notification.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.notification.dto.DeviceTokenDeleteRequest;
import com.ssafy.s15p11b104.domain.notification.dto.DeviceTokenRegisterRequest;
import com.ssafy.s15p11b104.domain.notification.dto.DeviceTokenResponse;
import com.ssafy.s15p11b104.domain.notification.service.DeviceTokenService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

import jakarta.validation.Valid;

@RestController
public class DeviceTokenController {

	private static final String REGISTER_MESSAGE = "기기 토큰 등록 성공";

	private final DeviceTokenService deviceTokenService;

	public DeviceTokenController(DeviceTokenService deviceTokenService) {
		this.deviceTokenService = deviceTokenService;
	}

	@PostMapping("/device-tokens")
	public ResponseEntity<ApiResponse<DeviceTokenResponse>> register(
		@AuthenticationPrincipal AuthenticatedUser user,
		@Valid @RequestBody DeviceTokenRegisterRequest request
	) {
		DeviceTokenService.RegistrationResult result = deviceTokenService.register(user.id(), request);
		HttpStatus status = result.created() ? HttpStatus.CREATED : HttpStatus.OK;
		return ResponseEntity
			.status(status)
			.body(ApiResponse.success(REGISTER_MESSAGE, result.response()));
	}

	@DeleteMapping("/device-tokens")
	public ResponseEntity<Void> deactivate(
		@AuthenticationPrincipal AuthenticatedUser user,
		@Valid @RequestBody DeviceTokenDeleteRequest request
	) {
		deviceTokenService.deactivate(user.id(), request);
		return ResponseEntity.noContent().build();
	}
}
