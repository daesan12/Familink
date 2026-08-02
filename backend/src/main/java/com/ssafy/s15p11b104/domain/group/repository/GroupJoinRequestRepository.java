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
	 * <p>연관 엔티티는 함께 조회하지 않는다. 이 프로젝트의 공통 잠금 순서는
	 * {@code users → family_groups → group_members → 자식 행}이고 가입 요청은 마지막 자식
	 * 행이다. PostgreSQL은 조인한 테이블의 행까지 잠그므로 신청자 계정이나 멤버십을 함께
	 * 조회하면 이 경로가 그 순서를 거슬러 잠가 교착 상태를 만든다. 신청자 계정을 잠가야 하는
	 * 호출자는 이 조회보다 먼저 {@code UserRepository.findActiveByIdForUpdate}를 사용한다.
	 * 신청자 탈퇴 여부는 호출자가 확인한다.
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

	/**
	 * 요청을 잠그기 전에 신청자 계정 id만 확인한다.
	 *
	 * <p>공통 잠금 순서가 계정 행을 먼저 요구하므로, 잠글 계정을 알아내는 이 조회는 잠그지 않는다.
	 * 요청이 없으면 비어 있는 결과를 돌려주고 호출자의 권한 검사와 404 판정을 앞지르지 않는다.
	 */
	@Query("""
		select request.applicant.id
		from GroupJoinRequest request
		where request.id = :joinRequestId
		  and request.group.id = :groupId
		""")
	Optional<Long> findApplicantUserIdByIdAndGroupId(
		@Param("joinRequestId") Long joinRequestId,
		@Param("groupId") Long groupId);

	boolean existsByGroupIdAndApplicantIdAndStatus(Long groupId, Long applicantId, JoinRequestStatus status);
}
