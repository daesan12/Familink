package com.ssafy.s15p11b104.domain.call.repository;

import java.util.Collection;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;

import jakarta.persistence.LockModeType;

public interface CallSessionRepository extends JpaRepository<CallSession, Long> {

	boolean existsByCareReceiverMemberIdAndStatusIn(Long careReceiverMemberId, Collection<CallStatus> statuses);

	Optional<CallSession> findByIdAndCareReceiverMemberId(Long id, Long careReceiverMemberId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
		select session
		from CallSession session
		where session.id = :sessionId
			and session.careReceiverMember.id = :careReceiverMemberId
		""")
	Optional<CallSession> findForUpdate(
		@Param("sessionId") Long sessionId,
		@Param("careReceiverMemberId") Long careReceiverMemberId
	);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select session from CallSession session where session.id = :sessionId")
	Optional<CallSession> findByIdForUpdate(@Param("sessionId") Long sessionId);
}
