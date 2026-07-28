package com.ssafy.s15p11b104.domain.account.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.dto.LoginIdAvailabilityResponse;
import com.ssafy.s15p11b104.domain.account.dto.LoginRequest;
import com.ssafy.s15p11b104.domain.account.dto.LoginResponse;
import com.ssafy.s15p11b104.domain.account.dto.SignupRequest;
import com.ssafy.s15p11b104.domain.account.dto.SignupResponse;
import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;
import com.ssafy.s15p11b104.global.security.AccessTokenProvider;
import com.ssafy.s15p11b104.global.security.RefreshTokenStore;

/**
 * 로그인 ID 확인, 회원가입, 로그인, 로그아웃을 처리한다.
 */
@Service
public class AuthService {

	private static final String TOKEN_TYPE = "Bearer";

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final AccessTokenProvider accessTokenProvider;
	private final RefreshTokenStore refreshTokenStore;

	AuthService(
		UserRepository userRepository,
		PasswordEncoder passwordEncoder,
		AccessTokenProvider accessTokenProvider,
		RefreshTokenStore refreshTokenStore
	) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.accessTokenProvider = accessTokenProvider;
		this.refreshTokenStore = refreshTokenStore;
	}

	/**
	 * 로그인 ID를 회원가입에 사용할 수 있는지 확인한다.
	 *
	 * @param loginId 확인할 로그인 ID
	 * @return 사용 가능 여부
	 */
	@Transactional(readOnly = true)
	public LoginIdAvailabilityResponse checkLoginIdAvailability(String loginId) {
		return new LoginIdAvailabilityResponse(!userRepository.existsByLoginId(loginId));
	}

	/**
	 * 새 계정을 만든다.
	 *
	 * @param request 회원가입 요청
	 * @return 생성된 계정 정보
	 * @throws BusinessException 로그인 ID가 이미 사용 중인 경우
	 */
	@Transactional
	public SignupResponse signup(SignupRequest request) {
		if (userRepository.existsByLoginId(request.loginId())) {
			throw new BusinessException(ErrorCode.LOGIN_ID_DUPLICATED);
		}

		User user = new User(
			request.loginId(),
			passwordEncoder.encode(request.password()),
			request.name(),
			request.birthDate(),
			request.gender());

		try {
			return SignupResponse.from(userRepository.saveAndFlush(user));
		} catch (DataIntegrityViolationException exception) {
			throw new BusinessException(ErrorCode.LOGIN_ID_DUPLICATED);
		}
	}

	/**
	 * 로그인 ID와 비밀번호를 검증하고 인증 토큰을 발급한다.
	 *
	 * @param request 로그인 요청
	 * @return 발급된 인증 정보
	 * @throws BusinessException 활성 계정이 없거나 비밀번호가 일치하지 않는 경우
	 */
	@Transactional(readOnly = true)
	public LoginResponse login(LoginRequest request) {
		User user = userRepository.findByLoginIdAndWithdrawnAtIsNull(request.loginId())
			.orElseThrow(() -> new BusinessException(ErrorCode.INVALID_CREDENTIALS));

		if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
			throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
		}

		return new LoginResponse(
			TOKEN_TYPE,
			accessTokenProvider.issue(user.getId()),
			accessTokenProvider.getValidityInSeconds(),
			refreshTokenStore.issue(user.getId()),
			new LoginResponse.LoginUser(user.getId(), user.getName()));
	}

	/**
	 * Refresh Token을 폐기해 로그아웃 처리한다.
	 *
	 * @param refreshToken 폐기할 Refresh Token
	 * @throws BusinessException 저장되어 있지 않거나 이미 폐기된 Refresh Token인 경우
	 */
	public void logout(String refreshToken) {
		if (!refreshTokenStore.revoke(refreshToken)) {
			throw new BusinessException(ErrorCode.UNAUTHORIZED);
		}
	}
}
