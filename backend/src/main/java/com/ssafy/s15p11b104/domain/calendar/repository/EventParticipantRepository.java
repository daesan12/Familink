package com.ssafy.s15p11b104.domain.calendar.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.calendar.entity.EventParticipant;

public interface EventParticipantRepository extends JpaRepository<EventParticipant, Long> {

	/**
	 * 일정에 연결된 참여자의 구성원 ID만 조회한다.
	 *
	 * <p>상세 응답이 ID 목록만 요구하므로 {@code GroupMember}를 로딩하지 않는 스칼라 프로젝션을 쓴다.
	 */
	@Query("""
		select participant.groupMember.id
		from EventParticipant participant
		where participant.event.id = :eventId
		order by participant.groupMember.id
		""")
	List<Long> findMemberIdsByEventId(@Param("eventId") Long eventId);

	/**
	 * 일정의 참여자를 모두 삭제한다.
	 *
	 * <p>참여자는 전체 교체 방식으로 갱신하므로 삭제 후 삽입 순서를 명시적으로 제어할 수 있도록
	 * 벌크 삭제를 쓴다. 호출자는 삽입 전에 flush로 삭제를 먼저 반영해야
	 * {@code uq_event_participants_event_member} 위반을 피할 수 있다.
	 */
	@Modifying
	@Query("delete from EventParticipant participant where participant.event.id = :eventId")
	int deleteAllByEventId(@Param("eventId") Long eventId);
}
