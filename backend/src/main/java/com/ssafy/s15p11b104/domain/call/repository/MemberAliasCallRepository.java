package com.ssafy.s15p11b104.domain.call.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.group.entity.MemberAlias;

public interface MemberAliasCallRepository extends JpaRepository<MemberAlias, Long> {

	@Query("""
		select alias
		from MemberAlias alias
		join fetch alias.targetMember target
		join fetch target.user
		where alias.group.id = :groupId
			and alias.ownerMember.id = :ownerMemberId
		""")
	List<MemberAlias> findAliases(
		@Param("groupId") Long groupId,
		@Param("ownerMemberId") Long ownerMemberId
	);
}
