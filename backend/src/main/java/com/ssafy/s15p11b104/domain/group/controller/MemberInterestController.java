package com.ssafy.s15p11b104.domain.group.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.group.dto.InterestReplaceRequest;
import com.ssafy.s15p11b104.domain.group.dto.InterestResponse;
import com.ssafy.s15p11b104.domain.group.service.MemberInterestService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/groups/{groupId}/members/{memberId}/interests")
public class MemberInterestController {

	private static final String GET_MESSAGE = "\uad00\uc2ec\uc0ac \uc870\ud68c \uc131\uacf5";
	private static final String PUT_MESSAGE = "\uad00\uc2ec\uc0ac \uc800\uc7a5 \uc131\uacf5";

	private final MemberInterestService memberInterestService;

	public MemberInterestController(MemberInterestService memberInterestService) {
		this.memberInterestService = memberInterestService;
	}

	@GetMapping
	public ApiResponse<InterestResponse> getInterests(
		@PathVariable Long groupId,
		@PathVariable Long memberId,
		@AuthenticationPrincipal AuthenticatedUser user) {
		return ApiResponse.success(
			GET_MESSAGE,
			memberInterestService.getInterests(groupId, memberId, user.id()));
	}

	@PutMapping
	@ResponseStatus(HttpStatus.OK)
	public ApiResponse<InterestResponse> replaceInterests(
		@PathVariable Long groupId,
		@PathVariable Long memberId,
		@AuthenticationPrincipal AuthenticatedUser user,
		@Valid @RequestBody InterestReplaceRequest request) {
		return ApiResponse.success(
			PUT_MESSAGE,
			memberInterestService.replaceInterests(groupId, memberId, user.id(), request));
	}
}
