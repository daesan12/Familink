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

	/**
	 * 그룹·사용자 조합의 활성 멤버십을 잠그지 않고 찾는다.
	 *
	 * <p>직렬화가 필요한 호출자는 이 조회 대신
	 * {@link #findActiveForUpdateByGroupIdAndUserId(Long, Long)}을 쓴다. 아래 설명은 이 조회를
	 * 그대로 두어야 하는 특정 호출자에 대한 것이고, 다른 호출자에게 잠금을 금지하지 않는다.
	 *
	 * <p>같은 트랜잭션에서 알림을 저장하는 호출자, 즉 게시글·댓글·일정 생성은 잠그지 않는 편이
	 * 안전하다. 알림 저장은 동기로 이루어지고 알림 행은 수신자와 행위자 두 방향으로 {@code users}를
	 * 참조하므로, INSERT가 그 계정 행에 {@code FOR KEY SHARE}를 건다. 여기에 계정 행
	 * {@code FOR UPDATE}를 더하면 같은 그룹의 두 작성 요청이 서로의 계정 행을 반대 순서로 요구해
	 * 교착이 된다. 잠금 대상을 멤버십 행으로 좁혀도 마찬가지다. 작성은
	 * {@code group_members → users}(행위자 FK) 순으로, 탈퇴는 {@code users → group_members} 순으로
	 * 요구해 순환이 생긴다. 잠금이 없는 현재는 그 순환이 없다.
	 *
	 * <p>그래서 탈퇴 직전 경쟁 창에서 만들어진 게시글·댓글·일정은 그대로 남을 수 있다. 탈퇴는
	 * 작성 기록과 과거 그룹 관계를 보존하므로 이는 계약 위반이 아니며, 복구할 수 없는 계정 부활이나
	 * 고아 그룹과 성격이 다르다. 이 경로까지 직렬화하려면 알림 저장을 커밋 이후로 옮기는 선행
	 * 변경이 필요하다.
	 */
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

	/**
	 * 그룹·사용자 조합의 활성 멤버십 행을 잠그고 찾는다.
	 *
	 * <p>{@code member.user}를 함께 조회하지 않는 것은 잠금 범위를 {@code group_members}로
	 * 제한하기 위해서다. PostgreSQL은 조인한 테이블의 행까지 잠그므로 함께 조회하면 이 경로가
	 * {@code group_members} 다음 {@code users}를 잠가, 공통 잠금 순서
	 * {@code users → family_groups → group_members → 자식 행}을 거스른다.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
		select member
		from GroupMember member
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

	/**
	 * 멤버십 행을 잠그기 전에 구성원의 계정 id만 확인한다.
	 *
	 * <p>공통 잠금 순서가 계정 행을 먼저 요구하므로 이 조회는 잠그지 않는다. 이미 떠난 구성원도
	 * 반환해, 호출자가 404와 409를 구분하는 기존 판정을 그대로 유지한다.
	 */
	@Query("""
		select member.user.id
		from GroupMember member
		where member.group.id = :groupId
		  and member.id = :memberId
		""")
	Optional<Long> findUserIdByGroupIdAndMemberId(
		@Param("groupId") Long groupId,
		@Param("memberId") Long memberId);

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
