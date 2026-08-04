package com.ssafy.s15p11b104.domain.calendar.repository;

import java.util.List;
import java.util.Collection;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.account.entity.User;
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
			and participant.groupMember.leftAt is null
		order by participant.groupMember.id
		""")
	List<Long> findMemberIdsByEventId(@Param("eventId") Long eventId);

	@Query("""
		select participant.event.id, participant.groupMember.id
		from EventParticipant participant
		where participant.event.id in :eventIds
		order by participant.event.id, participant.groupMember.id
		""")
	List<Object[]> findMemberIdsByEventIds(@Param("eventIds") Collection<Long> eventIds);

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

	/**
	 * 한 그룹의 특정 멤버십을 모든 일정 참여자에서 삭제한다.
	 *
	 * <p>그룹 조건을 함께 적용해 잘못 전달된 다른 그룹 멤버십 ID가 영향을 주지 않게 한다.
	 */
	@Modifying
	@Query("""
		delete from EventParticipant participant
		where participant.groupMember.id = :memberId
			and participant.event.group.id = :groupId
		""")
	int deleteAllByGroupIdAndMemberId(
		@Param("groupId") Long groupId,
		@Param("memberId") Long memberId);

	/**
	 * 일정의 활성 참여자에게 연결된 사용자를 조회한다.
	 *
	 * <p>탈퇴한 구성원에게는 알림을 보내지 않으므로 활성 조건을 건다.
	 */
	@Query("""
		select participant.groupMember.user
		from EventParticipant participant
		where participant.event.id = :eventId
			and participant.groupMember.leftAt is null
		order by participant.groupMember.user.id
		""")
	List<User> findActiveParticipantUsersByEventId(@Param("eventId") Long eventId);
}
