package com.ssafy.s15p11b104.domain.group.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.group.entity.GroupJoinRequest;

public interface GroupJoinRequestRepository extends JpaRepository<GroupJoinRequest, Long> {

	@Query("""
		select request
		from GroupJoinRequest request
		join fetch request.group
		where request.applicant.id = :applicantUserId
		order by request.createdAt desc
		""")
	List<GroupJoinRequest> findAllWithGroupByApplicantUserId(@Param("applicantUserId") Long applicantUserId);
}
