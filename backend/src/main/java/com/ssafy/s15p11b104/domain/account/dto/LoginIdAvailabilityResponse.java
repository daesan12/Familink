package com.ssafy.s15p11b104.domain.account.dto;

/**
 * 로그인 ID 중복 확인 결과다.
 *
 * @param available 회원가입에 사용할 수 있으면 {@code true}
 */
public record LoginIdAvailabilityResponse(boolean available) {
}
