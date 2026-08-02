package com.ssafy.s15p11b104.domain.account.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.dto.LoginIdAvailabilityResponse;
import com.ssafy.s15p11b104.domain.account.dto.LoginRequest;
import com.ssafy.s15p11b104.domain.account.dto.LoginResponse;
import com.ssafy.s15p11b104.domain.account.dto.ReissueRequest;
import com.ssafy.s15p11b104.domain.account.dto.ReissueResponse;
import com.ssafy.s15p11b104.domain.account.dto.SignupRequest;
import com.ssafy.s15p11b104.domain.account.dto.SignupResponse;
import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;
import com.ssafy.s15p11b104.global.security.AccessTokenBlacklist;
import com.ssafy.s15p11b104.global.security.AccessTokenProvider;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.global.security.RefreshTokenStore;

/**
 * 로그인 ID 확인, 회원가입, 로그인, 토큰 재발급, 로그아웃을 처리한다.
 */
@Service
public class AuthService {

	private static final String TOKEN_TYPE = "Bearer";

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final AccessTokenProvider accessTokenProvider;
	private final RefreshTokenStore refreshTokenStore;
	private final AccessTokenBlacklist accessTokenBlacklist;

	AuthService(
		UserRepository userRepository,
		PasswordEncoder passwordEncoder,
		AccessTokenProvider accessTokenProvider,
		RefreshTokenStore refreshTokenStore,
		AccessTokenBlacklist accessTokenBlacklist
	) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.accessTokenProvider = accessTokenProvider;
		this.refreshTokenStore = refreshTokenStore;
		this.accessTokenBlacklist = accessTokenBlacklist;
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
	 * Refresh Token을 검증해 새 Access Token과 새 Refresh Token을 발급한다.
	 *
	 * <p>회전 방식이므로 발급과 동시에 기존 Refresh Token은 폐기되어 다시 사용할 수 없다.
	 *
	 * @param request 재발급 요청
	 * @return 새로 발급된 인증 정보
	 * @throws BusinessException Refresh Token이 만료·위조되었거나 이미 폐기된 경우
	 */
	public ReissueResponse reissue(ReissueRequest request) {
		Long userId = refreshTokenStore.resolveOwner(request.refreshToken())
			.orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN));

		String rotatedToken = refreshTokenStore.rotate(userId, request.refreshToken())
			.orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN));

		return new ReissueResponse(
			TOKEN_TYPE,
			accessTokenProvider.issue(userId),
			accessTokenProvider.getValidityInSeconds(),
			rotatedToken);
	}

	/**
	 * 로그아웃해 현재 세션의 두 토큰을 모두 사용할 수 없게 한다.
	 *
	 * <p>인증에 사용된 Access Token은 항상 남은 만료 시간만큼 블랙리스트에 등록한다. Refresh Token은
	 * 제시된 것이 현재 저장된 토큰일 때만 폐기하므로, 이미 회전된 오래된 토큰으로 로그아웃해도 다른
	 * 기기의 활성 세션을 지우지 않는다. 이미 폐기된 토큰으로 다시 호출해도 결과 상태가 같으므로
	 * 성공으로 처리한다.
	 *
	 * @param user         인증된 요청 주체
	 * @param refreshToken 폐기할 Refresh Token
	 * @throws BusinessException Refresh Token을 검증할 수 없거나 다른 사용자의 토큰인 경우
	 */
	public void logout(AuthenticatedUser user, String refreshToken) {
		Long tokenOwner = refreshTokenStore.resolveOwner(refreshToken)
			.orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REQUEST));

		if (!tokenOwner.equals(user.id())) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}

		refreshTokenStore.revokeIfCurrent(user.id(), refreshToken);
		accessTokenProvider.verify(user.accessToken())
			.ifPresent(payload -> accessTokenBlacklist.register(user.accessToken(), payload.expiresAt()));
	}
}
