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

	/**
	 * 사용자의 활성 피보호자 멤버십을 조회한다.
	 *
	 * <p>{@code uq_user_active_care_receiver} 부분 유니크 인덱스가 사용자당 최대 1건을 보장하는
	 * 전제는 피보호자 역할에만 성립하므로, 역할을 호출자가 바꿀 수 없게 고정한다.
	 */
	default Optional<GroupMember> findActiveCareReceiverByUserId(Long userId) {
		return findActiveByUserIdAndRole(userId, GroupRole.CARE_RECEIVER);
	}

	/**
	 * {@link #findActiveCareReceiverByUserId(Long)} 전용 쿼리다. 보호자는 여러 활성 그룹에
	 * 속할 수 있어 단건 반환이 깨지므로 다른 역할로 직접 호출하지 않는다.
	 */
	@Query("""
		select member
		from GroupMember member
		where member.user.id = :userId
			and member.role = :role
			and member.leftAt is null
		""")
	Optional<GroupMember> findActiveByUserIdAndRole(
		@Param("userId") Long userId,
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

	@Query("""
		select member
		from GroupMember member
		where member.id = :memberId
			and member.group.id = :groupId
			and member.leftAt is null
		""")
	Optional<GroupMember> findActiveInGroup(
		@Param("memberId") Long memberId,
		@Param("groupId") Long groupId
	);
}
