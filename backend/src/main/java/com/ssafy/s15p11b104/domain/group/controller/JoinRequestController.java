package com.ssafy.s15p11b104.domain.group.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.group.dto.JoinRequestCreateRequest;
import com.ssafy.s15p11b104.domain.group.dto.JoinRequestCreateResponse;
import com.ssafy.s15p11b104.domain.group.dto.JoinRequestDecisionRequest;
import com.ssafy.s15p11b104.domain.group.dto.JoinRequestDecisionResponse;
import com.ssafy.s15p11b104.domain.group.dto.JoinRequestListResponse;
import com.ssafy.s15p11b104.domain.group.service.JoinRequestService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

@RestController
public class JoinRequestController {

	private static final String CREATE_MESSAGE = "가입 요청 생성 성공";
	private static final String LIST_MESSAGE = "가입 요청 목록 조회 성공";
	private static final String DECISION_MESSAGE = "가입 요청 처리 성공";

	private final JoinRequestService joinRequestService;

	public JoinRequestController(JoinRequestService joinRequestService) {
		this.joinRequestService = joinRequestService;
	}

	@PostMapping("/join-requests/by-code")
	@ResponseStatus(HttpStatus.CREATED)
	public ApiResponse<JoinRequestCreateResponse> createByInviteCode(
		@AuthenticationPrincipal AuthenticatedUser user,
		@RequestBody JoinRequestCreateRequest request) {
		return ApiResponse.success(CREATE_MESSAGE, joinRequestService.createByInviteCode(user.id(), request));
	}

	@GetMapping("/groups/{groupId}/join-requests")
	@ResponseStatus(HttpStatus.OK)
	public ApiResponse<JoinRequestListResponse> getJoinRequests(
		@PathVariable Long groupId,
		@AuthenticationPrincipal AuthenticatedUser user,
		@RequestParam(required = false) String status) {
		return ApiResponse.success(
			LIST_MESSAGE,
			joinRequestService.getJoinRequests(groupId, user.id(), status));
	}

	@PatchMapping("/groups/{groupId}/join-requests/{joinRequestId}")
	@ResponseStatus(HttpStatus.OK)
	public ApiResponse<JoinRequestDecisionResponse> decide(
		@PathVariable Long groupId,
		@PathVariable Long joinRequestId,
		@AuthenticationPrincipal AuthenticatedUser user,
		@RequestBody JoinRequestDecisionRequest request) {
		return ApiResponse.success(
			DECISION_MESSAGE,
			joinRequestService.decide(groupId, joinRequestId, user.id(), request));
	}
}
