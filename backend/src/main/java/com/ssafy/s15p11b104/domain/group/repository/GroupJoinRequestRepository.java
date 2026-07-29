package com.ssafy.s15p11b104.domain.group.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.group.entity.GroupJoinRequest;
import com.ssafy.s15p11b104.domain.group.entity.JoinRequestStatus;

public interface GroupJoinRequestRepository extends JpaRepository<GroupJoinRequest, Long> {

	@Query("""
		select request
		from GroupJoinRequest request
		join fetch request.group
		where request.applicant.id = :applicantUserId
		order by request.createdAt desc
		""")
	List<GroupJoinRequest> findAllWithGroupByApplicantUserId(@Param("applicantUserId") Long applicantUserId);

	/**
	 * 그룹 관리자에게 보여 줄 가입 요청을 찾는다.
	 *
	 * <p>탈퇴한 신청자의 요청은 제외한다. 탈퇴 시 개인정보가 익명화되어 신청자 이름이 비고, 승인해도
	 * 익명 계정의 활성 멤버십이 생기므로 관리자가 처리할 수 있는 대상이 아니다.
	 */
	@Query("""
		select request
		from GroupJoinRequest request
		join fetch request.applicant applicant
		where request.group.id = :groupId
		  and applicant.withdrawnAt is null
		order by request.createdAt desc
		""")
	List<GroupJoinRequest> findAllWithApplicantByGroupId(@Param("groupId") Long groupId);

	@Query("""
		select request
		from GroupJoinRequest request
		join fetch request.applicant applicant
		where request.group.id = :groupId
		  and request.status = :status
		  and applicant.withdrawnAt is null
		order by request.createdAt desc
		""")
	List<GroupJoinRequest> findAllWithApplicantByGroupIdAndStatus(
		@Param("groupId") Long groupId,
		@Param("status") JoinRequestStatus status);

	@Query("""
		select request
		from GroupJoinRequest request
		join fetch request.group
		join fetch request.applicant applicant
		where request.id = :joinRequestId
		  and request.group.id = :groupId
		  and applicant.withdrawnAt is null
		""")
	Optional<GroupJoinRequest> findByIdAndGroupId(
		@Param("joinRequestId") Long joinRequestId,
		@Param("groupId") Long groupId);

	boolean existsByGroupIdAndApplicantIdAndStatus(Long groupId, Long applicantId, JoinRequestStatus status);
}
