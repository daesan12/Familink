package com.ssafy.s15p11b104.domain.call.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;

import jakarta.persistence.LockModeType;

public interface GroupMemberCallRepository extends JpaRepository<GroupMember, Long> {

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
		select member
		from GroupMember member
		join fetch member.group
		join fetch member.user
		where member.id = :memberId
			and member.leftAt is null
		""")
	Optional<GroupMember> findActiveForUpdate(@Param("memberId") Long memberId);

	@Query("""
		select member
		from GroupMember member
		join fetch member.group
		join fetch member.user
		where member.user.loginId = :loginId
			and member.role = :role
			and member.leftAt is null
		""")
	Optional<GroupMember> findActiveCareReceiverByLoginId(
		@Param("loginId") String loginId,
		@Param("role") GroupRole role
	);

	@Query("""
		select member
		from GroupMember member
		join fetch member.user
		where member.group.id = :groupId
			and member.leftAt is null
		order by member.id
		""")
	List<GroupMember> findActiveMembers(@Param("groupId") Long groupId);
}
