package com.ssafy.s15p11b104.domain.account.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.account.dto.ProfileResponse;
import com.ssafy.s15p11b104.domain.account.dto.ProfileUpdateRequest;
import com.ssafy.s15p11b104.domain.account.dto.ProfileUpdateResponse;
import com.ssafy.s15p11b104.domain.account.service.UserService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

import jakarta.validation.Valid;

/**
 * 본인 프로필 조회·수정과 회원 탈퇴 API를 제공한다.
 */
@RestController
@RequestMapping("/users")
public class UserController {

	private static final String GET_PROFILE_MESSAGE = "내 프로필 조회 성공";
	private static final String UPDATE_PROFILE_MESSAGE = "내 프로필 수정 성공";

	private final UserService userService;

	UserController(UserService userService) {
		this.userService = userService;
	}

	/**
	 * 본인 프로필을 조회한다.
	 *
	 * @param user 인증된 요청 주체
	 * @return 프로필 정보
	 */
	@GetMapping("/me")
	public ApiResponse<ProfileResponse> getMyProfile(@AuthenticationPrincipal AuthenticatedUser user) {
		return ApiResponse.success(GET_PROFILE_MESSAGE, userService.getMyProfile(user.id()));
	}

	/**
	 * 본인 프로필에서 전달된 필드만 수정한다.
	 *
	 * @param user    인증된 요청 주체
	 * @param request 수정 요청
	 * @return 수정 결과
	 */
	@PatchMapping("/me")
	public ApiResponse<ProfileUpdateResponse> updateMyProfile(
		@AuthenticationPrincipal AuthenticatedUser user,
		@Valid @RequestBody ProfileUpdateRequest request) {
		return ApiResponse.success(UPDATE_PROFILE_MESSAGE, userService.updateMyProfile(user.id(), request));
	}

	/**
	 * 회원을 탈퇴 처리한다.
	 *
	 * @param user 인증된 요청 주체
	 */
	@DeleteMapping("/me")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void withdraw(@AuthenticationPrincipal AuthenticatedUser user) {
		userService.withdraw(user);
	}
}
