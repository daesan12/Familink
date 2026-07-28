package com.ssafy.s15p11b104.domain.account.dto;

import java.time.Instant;

import com.ssafy.s15p11b104.domain.account.entity.User;

/**
 * 회원가입 결과다.
 *
 * @param userId    생성된 사용자 ID
 * @param loginId   등록된 로그인 ID
 * @param name      등록된 사용자 이름
 * @param createdAt 계정 생성 시각
 */
public record SignupResponse(Long userId, String loginId, String name, Instant createdAt) {

	public static SignupResponse from(User user) {
		return new SignupResponse(user.getId(), user.getLoginId(), user.getName(), user.getCreatedAt());
	}
}
