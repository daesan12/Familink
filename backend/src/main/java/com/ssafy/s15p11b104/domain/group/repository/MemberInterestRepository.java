package com.ssafy.s15p11b104.domain.group.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.group.entity.MemberInterest;

public interface MemberInterestRepository extends JpaRepository<MemberInterest, Long> {

	@Query("""
		select interest
		from MemberInterest interest
		where interest.careReceiverMember.id = :memberId
		order by interest.id
		""")
	List<MemberInterest> findAllByCareReceiverMemberIdOrderById(
		@Param("memberId") Long memberId);

	@Modifying
	@Query("delete from MemberInterest interest where interest.careReceiverMember.id = :memberId")
	int deleteAllByCareReceiverMemberId(@Param("memberId") Long memberId);
}
