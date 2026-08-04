package com.ssafy.s15p11b104.domain.group.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.group.entity.GroupMember;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {

	/**
	 * 멤버십 행 하나를 잠그고 id를 돌려준다.
	 *
	 * <p>{@code group_members}는 게시글·댓글·반응·일정 참여자·관심사·카네이션·리포트가 참조하는
	 * 부모 테이블이다. {@code FOR UPDATE}로 잠그면 그 자식 INSERT의 외래 키 검사가 거는
	 * {@code FOR KEY SHARE}까지 막혀, 자기 멤버십 행을 잡고 다른 구성원 행을 참조하는 경로와
	 * 정반대 순서로 대기해 교착이 된다. {@code FOR NO KEY UPDATE}는 이 경로들끼리의 배타는
	 * 유지하면서 외래 키 검사는 막지 않는다.
	 *
	 * <p>JPA 잠금 모드에는 {@code FOR NO KEY UPDATE}가 없어 네이티브 쿼리로 지정한다. 연관
	 * 테이블을 함께 조회하지 않는 것도 같은 이유다. 조인한 테이블의 행까지 잠기면 잠금 범위가
	 * {@code group_members} 밖으로 넘어가 공통 순서
	 * {@code users → family_groups → group_members → 자식 행}을 거스른다.
	 */
	@Query(value = """
		select id
		from group_members
		where id = :memberId
		for no key update
		""", nativeQuery = true)
	Optional<Long> lockById(@Param("memberId") Long memberId);

	/**
	 * 멤버십 행을 잠그고 엔티티로 가져온다. 탈퇴 여부는 보지 않는다.
	 */
	default Optional<GroupMember> findByIdForUpdate(Long memberId) {
		return lockById(memberId).flatMap(this::findById);
	}

	/**
	 * 그룹·사용자 조합의 활성 멤버십을 잠그지 않고 찾는다.
	 *
	 * <p>조회와 권한 검사 전용이다. 검사와 쓰기 사이에 멤버십이 바뀌면 안 되는 호출자는
	 * {@link #findActiveForUpdateByGroupIdAndUserId(Long, Long)}을 쓴다.
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
	 * 그룹·사용자 조합의 활성 멤버십 행을 잠그고 활성이면 멤버십 id를 돌려준다.
	 *
	 * <p>잠금 모드와 연관 미조회 이유는 {@link #lockById(Long)}와 같다.
	 */
	@Query(value = """
		select id
		from group_members
		where group_id = :groupId
		  and user_id = :userId
		  and left_at is null
		for no key update
		""", nativeQuery = true)
	Optional<Long> lockActiveByGroupIdAndUserId(
		@Param("groupId") Long groupId,
		@Param("userId") Long userId);

	/**
	 * 그룹·사용자 조합의 활성 멤버십 행을 잠그고 엔티티로 가져온다.
	 */
	default Optional<GroupMember> findActiveForUpdateByGroupIdAndUserId(Long groupId, Long userId) {
		return lockActiveByGroupIdAndUserId(groupId, userId).flatMap(this::findById);
	}

	/**
	 * 한 사용자의 여러 그룹 활성 멤버십 행을 한 번에 잠그고 멤버십 id를 돌려준다.
	 *
	 * <p>{@code id} 오름차순으로 고정한다. 이 순서는 {@link #lockAllActiveIdsByUserId(Long)}와
	 * 같아야 한다. 두 경로가 같은 행들을 다른 순서로 잠그면 서로를 기다린다. 특히 {@code group_id}
	 * 오름차순으로 잠그면, 사용자가 먼저 만들어진 그룹에 나중에 가입한 경우 두 순서가 역전되어
	 * 회원 탈퇴와 교착한다.
	 *
	 * <p>활성이 아닌 멤버십은 결과에서 빠지므로 호출자는 반환 개수로 거절 여부를 판단한다. 잠금
	 * 모드 이유는 {@link #lockById(Long)}와 같다.
	 */
	@Query(value = """
		select id
		from group_members
		where group_id in (:groupIds)
		  and user_id = :userId
		  and left_at is null
		order by id
		for no key update
		""", nativeQuery = true)
	List<Long> lockActiveIdsByGroupIdsAndUserId(
		@Param("groupIds") Collection<Long> groupIds,
		@Param("userId") Long userId);

	/**
	 * 한 사용자의 여러 그룹 활성 멤버십 행을 한 번에 잠그고 엔티티로 가져온다.
	 */
	default List<GroupMember> findAllActiveForUpdateByGroupIdsAndUserId(
		Collection<Long> groupIds, Long userId) {
		return findAllById(lockActiveIdsByGroupIdsAndUserId(groupIds, userId));
	}

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
	 * 덮어써 관리자가 없는 그룹이 남을 수 있다. 잠금 모드와 연관 미조회 이유는
	 * {@link #lockById(Long)}와 같다.
	 */
	@Query(value = """
		select id
		from group_members
		where group_id = :groupId
		  and id = :memberId
		for no key update
		""", nativeQuery = true)
	Optional<Long> lockByGroupIdAndMemberId(
		@Param("groupId") Long groupId,
		@Param("memberId") Long memberId);

	/**
	 * 관리 대상 구성원 행을 잠그고 엔티티로 가져온다.
	 */
	default Optional<GroupMember> findForUpdateByGroupIdAndMemberId(Long groupId, Long memberId) {
		return lockByGroupIdAndMemberId(groupId, memberId).flatMap(this::findById);
	}

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
	 *
	 * <p>여러 행을 잠그므로 {@code id} 오름차순으로 고정한다. 순서를 정하지 않으면 같은 행들을
	 * 다른 순서로 잠그는 트랜잭션과 서로를 기다린다. 잠금 모드 이유는 {@link #lockById(Long)}와
	 * 같다.
	 */
	@Query(value = """
		select id
		from group_members
		where user_id = :userId
		  and left_at is null
		order by id
		for no key update
		""", nativeQuery = true)
	List<Long> lockAllActiveIdsByUserId(@Param("userId") Long userId);

	/**
	 * 한 사용자의 활성 멤버십 행을 모두 잠그고 엔티티로 가져온다.
	 */
	default List<GroupMember> findAllActiveForUpdateByUserId(Long userId) {
		return findAllById(lockAllActiveIdsByUserId(userId));
	}

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
		select member
		from GroupMember member
		join fetch member.user
		join fetch member.group
		where member.group.id in :groupIds
		  and member.leftAt is null
		order by member.group.id, member.id
		""")
	List<GroupMember> findAllActiveByGroupIds(@Param("groupIds") Collection<Long> groupIds);

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
