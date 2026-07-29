package com.ssafy.s15p11b104.domain.account.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.account.dto.LoginIdAvailabilityResponse;
import com.ssafy.s15p11b104.domain.account.dto.LoginRequest;
import com.ssafy.s15p11b104.domain.account.dto.LoginResponse;
import com.ssafy.s15p11b104.domain.account.dto.LogoutRequest;
import com.ssafy.s15p11b104.domain.account.dto.ReissueRequest;
import com.ssafy.s15p11b104.domain.account.dto.ReissueResponse;
import com.ssafy.s15p11b104.domain.account.dto.SignupRequest;
import com.ssafy.s15p11b104.domain.account.dto.SignupResponse;
import com.ssafy.s15p11b104.domain.account.service.AuthService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 로그인 ID 확인, 회원가입, 로그인, 토큰 재발급, 로그아웃 API를 제공한다.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

	private static final String LOGIN_ID_CHECK_MESSAGE = "로그인 아이디 중복 확인 성공";
	private static final String SIGNUP_MESSAGE = "회원가입 성공";
	private static final String LOGIN_MESSAGE = "로그인 성공";
	private static final String REISSUE_MESSAGE = "토큰 재발급 성공";

	private final AuthService authService;

	AuthController(AuthService authService) {
		this.authService = authService;
	}

	/**
	 * 로그인 ID를 회원가입에 사용할 수 있는지 확인한다.
	 *
	 * <p>회원가입과 같은 형식 조건을 적용해, 확인 결과와 실제 가입 가능 여부가 어긋나지 않게 한다.
	 *
	 * @param loginId 확인할 로그인 ID
	 * @return 사용 가능 여부
	 */
	@GetMapping("/login-id/check")
	public ApiResponse<LoginIdAvailabilityResponse> checkLoginId(
		@RequestParam @NotBlank @Size(min = 5, max = 15) @Pattern(regexp = "\\S+") String loginId) {
		return ApiResponse.success(LOGIN_ID_CHECK_MESSAGE, authService.checkLoginIdAvailability(loginId));
	}

	/**
	 * 새 계정을 만든다.
	 *
	 * @param request 회원가입 요청
	 * @return 생성된 계정 정보
	 */
	@PostMapping("/signup")
	@ResponseStatus(HttpStatus.CREATED)
	public ApiResponse<SignupResponse> signup(@Valid @RequestBody SignupRequest request) {
		return ApiResponse.success(SIGNUP_MESSAGE, authService.signup(request));
	}

	/**
	 * 로그인해 인증 토큰을 발급받는다.
	 *
	 * @param request 로그인 요청
	 * @return 발급된 인증 정보
	 */
	@PostMapping("/login")
	public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
		return ApiResponse.success(LOGIN_MESSAGE, authService.login(request));
	}

	/**
	 * Refresh Token으로 Access Token과 Refresh Token을 재발급받는다.
	 *
	 * <p>Access Token이 만료된 상태에서 호출하므로 Refresh Token만 검증한다.
	 *
	 * @param request 재발급 요청
	 * @return 새로 발급된 인증 정보
	 */
	@PostMapping("/reissue")
	public ApiResponse<ReissueResponse> reissue(@Valid @RequestBody ReissueRequest request) {
		return ApiResponse.success(REISSUE_MESSAGE, authService.reissue(request));
	}

	/**
	 * 로그아웃해 현재 세션의 Access Token과 Refresh Token을 모두 사용할 수 없게 한다.
	 *
	 * @param user    인증된 요청 주체
	 * @param request 로그아웃 요청
	 */
	@PostMapping("/logout")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void logout(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody LogoutRequest request) {
		authService.logout(user, request.refreshToken());
	}
}
