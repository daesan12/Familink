package com.ssafy.s15p11b104.domain.group.dto;

/**
 * 초대 코드로 가입을 요청하는 명령이다.
 *
 * <p>{@code inviteCode}는 계약에 정의된 {@code INVITE_CODE_INVALID}를 반환하기 위해 Bean
 * Validation을 걸지 않고 서비스에서 검증한다. `@NotNull`을 쓰면 누락이
 * {@code INVALID_REQUEST}로 처리되어 `API-GROUPS-003`의 명시 오류와 어긋난다.
 */
public record JoinRequestCreateRequest(String inviteCode) {
}
