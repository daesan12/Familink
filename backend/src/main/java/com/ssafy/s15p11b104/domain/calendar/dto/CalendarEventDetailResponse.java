package com.ssafy.s15p11b104.domain.calendar.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * 일정 상세 응답이다.
 *
 * <p>{@code eventDate}는 시작 날짜, {@code endDate}는 종료 날짜이며 하루짜리 일정은 두 값이 같다.
 *
 * <p>{@code creatorDisplayName}은 조회자의 호칭을 반영한 작성자 표시 이름이다. 작성자가 그룹을
 * 나가면 {@code API-GROUPS-005}의 활성 구성원 목록에서 사라져 클라이언트가 이름을 조회할 수 없으므로
 * 항상 서버가 해석해 채운다. {@code creatorMemberId}는 클라이언트가 삭제 권한을 판정하는 데 쓰므로
 * 표시 이름과 함께 유지한다.
 */
public record CalendarEventDetailResponse(
	Long id,
	Long groupId,
	String title,
	String description,
	LocalDate eventDate,
	LocalDate endDate,
	Instant startAt,
	Instant endAt,
	Long creatorMemberId,
	String creatorDisplayName,
	List<Long> participantMemberIds) {
}
