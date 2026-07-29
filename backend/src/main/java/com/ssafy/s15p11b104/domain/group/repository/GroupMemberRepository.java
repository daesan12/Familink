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

	@Query("""
		select member
		from GroupMember member
		where member.user.id = :userId
		  and member.leftAt is null
		""")
	List<GroupMember> findAllActiveByUserId(@Param("userId") Long userId);

	@Query("""
		select count(member) > 0
		from GroupMember member
		where member.user.id = :userId
		  and member.leftAt is null
		  and member.manager = true
		""")
	boolean existsActiveManagerByUserId(@Param("userId") Long userId);
}
