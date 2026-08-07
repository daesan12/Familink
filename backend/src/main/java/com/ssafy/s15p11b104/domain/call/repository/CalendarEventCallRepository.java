package com.ssafy.s15p11b104.domain.call.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.calendar.entity.CalendarEvent;

/**
 * AI 통화 일정 Tool이 일반 목록 조회 응답에 없는 항목을 보충 조회한다.
 *
 * <p>권한 검사와 기간 겹침 판정은
 * {@link com.ssafy.s15p11b104.domain.calendar.service.CalendarEventService}가 담당하므로
 * 이 리포지토리는 이미 권한이 확인된 일정 ID만 받는다. 공개 목록 API 응답 계약을 바꾸지 않기
 * 위해 별도 경로로 조회한다.
 */
public interface CalendarEventCallRepository extends JpaRepository<CalendarEvent, Long> {

	@Query("""
		select event.id, event.description
		from CalendarEvent event
		where event.id in :eventIds
			and event.description is not null
		""")
	List<Object[]> findDescriptionsByEventIds(@Param("eventIds") Collection<Long> eventIds);

	/**
	 * 일정별 활성 참여자의 이름을 조회한다.
	 *
	 * <p>그룹을 떠난 구성원은 제외한다. 일정 상세 응답의 {@code participantMemberIds}와 같은
	 * 기준이며, 모델은 ID를 쓸 수 없으므로 이름을 조회한다.
	 */
	@Query("""
		select participant.event.id, participant.groupMember.user.name
		from EventParticipant participant
		where participant.event.id in :eventIds
			and participant.groupMember.leftAt is null
		order by participant.event.id, participant.groupMember.id
		""")
	List<Object[]> findParticipantNamesByEventIds(@Param("eventIds") Collection<Long> eventIds);
}
