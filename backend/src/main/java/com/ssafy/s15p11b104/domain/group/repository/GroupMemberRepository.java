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
	 * 관리 대상 구성원 행을 잠그고 탈퇴 여부와 관계없이 찾는다.
	 *
	 * <p>구성원 관리 API는 존재하지 않는 구성원과 이미 떠난 구성원을 각각 404와 409로 구분해야
	 * 하므로 활성 조건을 걸지 않는다.
	 *
	 * <p>관리자 위임은 대상을 활성 관리자로 승격시키므로, 대상이 같은 시점에 그룹을 떠나거나
	 * 회원 탈퇴하는 트랜잭션과 직렬화되어야 한다. 잠그지 않으면 두 트랜잭션이 서로의 변경을
	 * 덮어써 관리자가 없는 그룹이 남을 수 있다. {@code member.user}를 함께 조회하지 않는 것은
	 * 잠금 범위를 {@code group_members}로 제한하기 위해서다.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
		select member
		from GroupMember member
		where member.group.id = :groupId
		  and member.id = :memberId
		""")
	Optional<GroupMember> findForUpdateByGroupIdAndMemberId(
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

	/**
	 * 한 사용자의 활성 멤버십을 모두 잠그고 가져온다.
	 *
	 * <p>회원 탈퇴는 관리자 여부를 확인한 뒤 같은 행들을 비활성화한다. 잠그지 않으면 확인과
	 * 변경 사이에 다른 트랜잭션이 이 사용자를 관리자로 승격시켜, 관리자가 없는 그룹이 남는다.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
		select member
		from GroupMember member
		where member.user.id = :userId
		  and member.leftAt is null
		""")
	List<GroupMember> findAllActiveForUpdateByUserId(@Param("userId") Long userId);

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

}
