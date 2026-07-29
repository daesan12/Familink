package com.ssafy.s15p11b104.domain.group.dto;

import com.ssafy.s15p11b104.domain.group.entity.GroupRole;

/**
 * 가입 요청 처리 명령이다.
 *
 * <p>{@code decision}은 계약에 정의된 {@code INVALID_JOIN_REQUEST_DECISION}을 반환하기 위해
 * 열거형이 아닌 문자열로 받아 서비스에서 검증한다. 열거형으로 받으면 역직렬화 실패가
 * {@code INVALID_REQUEST}로 처리되어 계약과 어긋난다.
 *
 * @param decision     `APPROVE` 또는 `REJECT`
 * @param assignedRole 승인 시 지정할 역할. 거절이면 생략하거나 {@code null}
 */
public record JoinRequestDecisionRequest(
	String decision,
	GroupRole assignedRole) {
}
