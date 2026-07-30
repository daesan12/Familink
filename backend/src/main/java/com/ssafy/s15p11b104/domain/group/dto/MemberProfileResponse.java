package com.ssafy.s15p11b104.domain.group.dto;

import com.ssafy.s15p11b104.domain.account.entity.UserGender;

/**
 * 같은 그룹 활성 구성원에게 공개하는 축소 프로필이다.
 *
 * <p>{@code age}와 {@code gender}는 아직 생년월일과 성별을 입력하지 않은 사용자에서
 * {@code null}이다. 탈퇴한 사용자는 활성 멤버십이 함께 종료되므로 이 응답으로 조회되지 않는다.
 */
public record MemberProfileResponse(
	Long memberId,
	String displayName,
	Integer age,
	UserGender gender) {
}
