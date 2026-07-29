package com.ssafy.s15p11b104.domain.account.service;

import java.time.Instant;
import java.util.List;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.dto.ProfileResponse;
import com.ssafy.s15p11b104.domain.account.dto.ProfileUpdateRequest;
import com.ssafy.s15p11b104.domain.account.dto.ProfileUpdateResponse;
import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;
import com.ssafy.s15p11b104.global.security.AccessTokenBlacklist;
import com.ssafy.s15p11b104.global.security.AccessTokenProvider;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.global.security.RefreshTokenStore;

/**
 * 본인 프로필 조회·수정과 회원 탈퇴를 처리한다.
 */
@Service
public class UserService {

	private final UserRepository userRepository;
	private final GroupMemberRepository groupMemberRepository;
	private final RefreshTokenStore refreshTokenStore;
	private final AccessTokenProvider accessTokenProvider;
	private final AccessTokenBlacklist accessTokenBlacklist;

	UserService(
		UserRepository userRepository,
		GroupMemberRepository groupMemberRepository,
		RefreshTokenStore refreshTokenStore,
		AccessTokenProvider accessTokenProvider,
		AccessTokenBlacklist accessTokenBlacklist
	) {
		this.userRepository = userRepository;
		this.groupMemberRepository = groupMemberRepository;
		this.refreshTokenStore = refreshTokenStore;
		this.accessTokenProvider = accessTokenProvider;
		this.accessTokenBlacklist = accessTokenBlacklist;
	}

	/**
	 * 본인 프로필을 조회한다.
	 *
	 * @param userId 인증된 사용자 ID
	 * @return 프로필 정보
	 * @throws BusinessException 활성 계정이 아닌 경우
	 */
	@Transactional(readOnly = true)
	public ProfileResponse getMyProfile(Long userId) {
		return ProfileResponse.from(getActiveUser(userId));
	}

	/**
	 * 본인 프로필에서 전달된 필드만 수정한다.
	 *
	 * <p>로그인 ID는 다른 사용자가 사용 중이면 변경할 수 없다. 조회로 미리 걸러도 동시에 같은 ID로
	 * 변경하는 요청은 통과할 수 있으므로, UNIQUE 제약 위반까지 같은 오류로 변환한다. 이 변환을 위해
	 * {@code save}가 아닌 {@code saveAndFlush}를 사용한다. 커밋 시점까지 flush를 미루면 제약 위반이
	 * 이 메서드 밖에서 발생해 계약에 없는 오류로 응답한다.
	 *
	 * @param userId  인증된 사용자 ID
	 * @param request 수정 요청
	 * @return 수정 결과
	 * @throws BusinessException 활성 계정이 아니거나 로그인 ID가 이미 사용 중인 경우
	 */
	@Transactional
	public ProfileUpdateResponse updateMyProfile(Long userId, ProfileUpdateRequest request) {
		User user = getActiveUser(userId);

		String newLoginId = request.loginId();
		if (newLoginId != null && !newLoginId.equals(user.getLoginId())
			&& userRepository.existsByLoginId(newLoginId)) {
			throw new BusinessException(ErrorCode.LOGIN_ID_DUPLICATED);
		}

		user.updateProfile(newLoginId, request.name(), request.birthDate(), request.gender());
		if (request.profileImageUrlProvided()) {
			user.updateProfileImageUrl(request.profileImageUrl());
		}

		try {
			return ProfileUpdateResponse.from(userRepository.saveAndFlush(user));
		} catch (DataIntegrityViolationException exception) {
			throw new BusinessException(ErrorCode.LOGIN_ID_DUPLICATED);
		}
	}

	/**
	 * 회원을 탈퇴 처리한다.
	 *
	 * <p>계정 행과 작성 기록은 남기고 개인정보만 익명화한다. 활성 그룹 구성원 자격은 함께 종료해
	 * 익명화된 사용자가 활성 구성원 목록과 인원수에 남지 않게 한다. 활성 그룹의 관리자는 관리자가
	 * 없는 그룹이 생기지 않도록 먼저 권한을 위임해야 한다.
	 *
	 * <p>토큰도 함께 끊는다. Refresh Token은 사용자 키를 삭제해 재발급을 막고, 요청에 사용된 Access
	 * Token은 남은 만료 시간만큼 차단한다. 차단 범위는 이 요청에 실린 토큰 하나이므로, 재발급으로
	 * 이미 받아 둔 다른 Access Token은 만료될 때까지 서명 검증을 통과한다. 팀이 확정한 블랙리스트
	 * 설계가 토큰 단위 키(`blacklist:{accessToken}`)여서 현 범위에서는 사용자 단위로 무효화하지
	 * 않는다. 이 잔여 위험은 변경 제안에 기록했다.
	 *
	 * <p>Redis 조작을 커밋보다 먼저 수행한다. 이 순서에서는 Redis가 실패하면 트랜잭션이 롤백되어
	 * 계정이 활성 상태로 남고, 반대로 커밋이 실패하면 세션만 끊겨 재로그인으로 복구된다. 순서를
	 * 뒤집으면 커밋된 탈퇴에 살아 있는 세션이 남을 수 있다.
	 *
	 * @param user 인증된 요청 주체
	 * @throws BusinessException 활성 계정이 아니거나 활성 그룹의 관리자인 경우
	 */
	@Transactional
	public void withdraw(AuthenticatedUser user) {
		User account = getActiveUser(user.id());

		if (groupMemberRepository.existsActiveManagerByUserId(account.getId())) {
			throw new BusinessException(ErrorCode.MANAGER_TRANSFER_REQUIRED);
		}

		Instant now = Instant.now();
		List<GroupMember> activeMemberships = groupMemberRepository.findAllActiveByUserId(account.getId());
		activeMemberships.forEach(membership -> membership.leave(now));
		account.withdraw(now);

		refreshTokenStore.revoke(account.getId());
		accessTokenProvider.verify(user.accessToken())
			.ifPresent(payload -> accessTokenBlacklist.register(user.accessToken(), payload.expiresAt()));
	}

	private User getActiveUser(Long userId) {
		return userRepository.findByIdAndWithdrawnAtIsNull(userId)
			.orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
	}
}
