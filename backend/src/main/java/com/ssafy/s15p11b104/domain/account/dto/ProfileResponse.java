package com.ssafy.s15p11b104.domain.account.dto;

import java.time.LocalDate;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;

/**
 * 본인 프로필 조회 결과다.
 *
 * <p>사용자 ID는 응답에 포함하지 않는다. 요청자는 Access Token으로 이미 식별되어 있다.
 *
 * @param loginId         로그인 ID
 * @param name            이름
 * @param birthDate       생년월일
 * @param gender          성별
 * @param profileImageUrl 프로필 이미지 주소. 등록하지 않았으면 {@code null}
 */
public record ProfileResponse(
	String loginId,
	String name,
	LocalDate birthDate,
	UserGender gender,
	String profileImageUrl
) {

	public static ProfileResponse from(User user) {
		return new ProfileResponse(
			user.getLoginId(),
			user.getName(),
			user.getBirthDate(),
			user.getGender(),
			user.getProfileImageUrl());
	}
}
