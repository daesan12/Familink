package com.ssafy.s15p11b104.domain.group.repository;

import java.util.Optional;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.group.entity.MemberAlias;

public interface MemberAliasRepository extends JpaRepository<MemberAlias, Long> {

	@Query("""
		select alias
		from MemberAlias alias
		where alias.group.id = :groupId
		  and alias.ownerMember.id = :ownerMemberId
		  and alias.targetMember.id = :targetMemberId
		""")
	Optional<MemberAlias> findByGroupIdAndOwnerMemberIdAndTargetMemberId(
		@Param("groupId") Long groupId,
		@Param("ownerMemberId") Long ownerMemberId,
		@Param("targetMemberId") Long targetMemberId);

	@Query("""
		select alias
		from MemberAlias alias
		where alias.group.id = :groupId
		  and alias.ownerMember.id = :ownerMemberId
		  and alias.targetMember.id in :targetMemberIds
		""")
	List<MemberAlias> findAllByGroupIdAndOwnerMemberIdAndTargetMemberIdIn(
		@Param("groupId") Long groupId,
		@Param("ownerMemberId") Long ownerMemberId,
		@Param("targetMemberIds") Collection<Long> targetMemberIds);
}
