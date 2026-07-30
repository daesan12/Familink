package com.ssafy.s15p11b104.domain.group.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import com.ssafy.s15p11b104.domain.group.entity.GroupMember;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
		select member
		from GroupMember member
		join fetch member.group
		where member.id = :memberId
		""")
	Optional<GroupMember> findByIdForUpdate(@Param("memberId") Long memberId);

	@Query("""
		select member
		from GroupMember member
		join fetch member.user
		where member.group.id = :groupId
		  and member.user.id = :userId
		  and member.leftAt is null
		""")
	Optional<GroupMember> findActiveByGroupIdAndUserId(
		@Param("groupId") Long groupId,
		@Param("userId") Long userId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
		select member
		from GroupMember member
		join fetch member.user
		where member.group.id = :groupId
		  and member.user.id = :userId
		  and member.leftAt is null
		""")
	Optional<GroupMember> findActiveForUpdateByGroupIdAndUserId(
		@Param("groupId") Long groupId,
		@Param("userId") Long userId);

	@Query("""
		select member
		from GroupMember member
		join fetch member.user
		where member.group.id = :groupId
		  and member.id = :memberId
		  and member.leftAt is null
		""")
	Optional<GroupMember> findActiveByGroupIdAndMemberId(
		@Param("groupId") Long groupId,
		@Param("memberId") Long memberId);

	/**
	 * 탈퇴 여부와 관계없이 그룹·사용자 조합의 멤버십 행을 찾는다.
	 *
	 * <p>재가입 시 중복 행을 만들지 않고 기존 행을 재활성화하기 위해 사용한다.
	 */
	@Query("""
		select member
		from GroupMember member
		join fetch member.user
		where member.group.id = :groupId
		  and member.user.id = :userId
		""")
	Optional<GroupMember> findByGroupIdAndUserId(
		@Param("groupId") Long groupId,
		@Param("userId") Long userId);

	@Query("""
		select member
		from GroupMember member
		where member.user.id = :userId
		  and member.leftAt is null
		""")
	List<GroupMember> findAllActiveByUserId(@Param("userId") Long userId);

	@Query("""
		select member
		from GroupMember member
		join fetch member.group
		where member.user.id = :userId
		  and member.leftAt is null
		""")
	List<GroupMember> findAllActiveWithGroupByUserId(@Param("userId") Long userId);

	@Query("""
		select member
		from GroupMember member
		join fetch member.user
		join fetch member.group
		where member.group.id = :groupId
		  and member.leftAt is null
		""")
	List<GroupMember> findAllActiveByGroupId(@Param("groupId") Long groupId);

	@Query("""
		select member.group.id as groupId, count(member) as memberCount
		from GroupMember member
		where member.group.id in :groupIds
		  and member.leftAt is null
		group by member.group.id
		""")
	List<ActiveMemberCount> countActiveByGroupIds(@Param("groupIds") List<Long> groupIds);

	interface ActiveMemberCount {

		Long getGroupId();

		long getMemberCount();
	}

	@Query("""
		select count(member) > 0
		from GroupMember member
		where member.user.id = :userId
		  and member.leftAt is null
		  and member.manager = true
		""")
	boolean existsActiveManagerByUserId(@Param("userId") Long userId);
}
