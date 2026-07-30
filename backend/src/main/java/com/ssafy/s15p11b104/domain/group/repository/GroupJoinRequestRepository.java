package com.ssafy.s15p11b104.domain.group.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

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

	/**
	 * 승인·거절 처리를 위해 가입 요청 행을 잠근 뒤 찾는다.
	 *
	 * <p>잠그지 않으면 같은 요청을 동시에 처리하는 두 트랜잭션이 모두 대기 상태를 읽어 통과하고,
	 * 나중에 커밋한 쪽이 앞선 결정을 덮어쓴다. 그 결과 거절된 요청에 활성 멤버십이 남을 수 있다.
	 *
	 * <p>연관 엔티티는 함께 조회하지 않는다. PostgreSQL은 조인한 테이블의 행까지 잠그므로, 신청자
	 * 계정을 함께 잠그면 이 경로는 `users` 다음 `group_members`를 잠그게 된다. 반대로
	 * {@code GroupMemberRepository.findActiveForUpdateByGroupIdAndUserId}는 `group_members`와
	 * `users`를 함께 잠근다. 두 순서가 엇갈리면 교착 상태가 된다. 신청자 탈퇴 여부는 호출자가
	 * 확인한다.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
		select request
		from GroupJoinRequest request
		where request.id = :joinRequestId
		  and request.group.id = :groupId
		""")
	Optional<GroupJoinRequest> findForUpdateByIdAndGroupId(
		@Param("joinRequestId") Long joinRequestId,
		@Param("groupId") Long groupId);

	boolean existsByGroupIdAndApplicantIdAndStatus(Long groupId, Long applicantId, JoinRequestStatus status);
}
