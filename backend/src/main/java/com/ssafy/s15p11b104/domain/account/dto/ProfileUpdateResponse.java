package com.ssafy.s15p11b104.domain.account.dto;

import java.time.Instant;

import com.ssafy.s15p11b104.domain.account.entity.User;

/**
 * 본인 프로필 수정 결과다.
 *
 * @param id        사용자 ID
 * @param name      수정 후 이름
 * @param updatedAt 수정 시각
 */
public record ProfileUpdateResponse(Long id, String name, Instant updatedAt) {

	public static ProfileUpdateResponse from(User user) {
		return new ProfileUpdateResponse(user.getId(), user.getName(), user.getUpdatedAt());
	}
}
