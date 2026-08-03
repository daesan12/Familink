package com.ssafy.s15p11b104.domain.group.service;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.file.service.MediaDownloadUrlProvider;
import com.ssafy.s15p11b104.domain.group.dto.JoinRequestCreateRequest;
import com.ssafy.s15p11b104.domain.group.dto.JoinRequestCreateResponse;
import com.ssafy.s15p11b104.domain.group.dto.JoinRequestDecisionRequest;
import com.ssafy.s15p11b104.domain.group.dto.JoinRequestDecisionResponse;
import com.ssafy.s15p11b104.domain.group.dto.JoinRequestItemResponse;
import com.ssafy.s15p11b104.domain.group.dto.JoinRequestListResponse;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupJoinRequest;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.entity.JoinRequestStatus;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupJoinRequestRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.notification.event.DomainNotificationEvent;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ConstraintViolationTranslator;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

@Service
public class JoinRequestService {

	private static final String DECISION_APPROVE = "APPROVE";
	private static final String DECISION_REJECT = "REJECT";

	private final FamilyGroupRepository familyGroupRepository;
	private final GroupMemberRepository groupMemberRepository;
	private final GroupJoinRequestRepository groupJoinRequestRepository;
	private final UserRepository userRepository;
	private final ConstraintViolationTranslator constraintViolationTranslator;
	private final ApplicationEventPublisher eventPublisher;
	private final MediaDownloadUrlProvider mediaDownloadUrlProvider;

	public JoinRequestService(
		FamilyGroupRepository familyGroupRepository,
		GroupMemberRepository groupMemberRepository,
		GroupJoinRequestRepository groupJoinRequestRepository,
		UserRepository userRepository,
		ConstraintViolationTranslator constraintViolationTranslator,
		ApplicationEventPublisher eventPublisher,
		MediaDownloadUrlProvider mediaDownloadUrlProvider) {
		this.familyGroupRepository = familyGroupRepository;
		this.groupMemberRepository = groupMemberRepository;
		this.groupJoinRequestRepository = groupJoinRequestRepository;
		this.userRepository = userRepository;
		this.constraintViolationTranslator = constraintViolationTranslator;
		this.eventPublisher = eventPublisher;
		this.mediaDownloadUrlProvider = mediaDownloadUrlProvider;
	}

	/**
	 * 초대 코드로 대기 중 가입 요청을 만든다.
	 *
	 * <p>신청자 계정 행을 잠근 뒤 중복 여부를 검사해 같은 사용자의 동시 요청을 직렬화한다.
	 * 잠그지 않으면 두 트랜잭션이 사전 검사를 모두 통과한 뒤 대기 중 요청을 한 건으로 제한하는
	 * 부분 유니크 인덱스에서 한쪽이 실패한다. 잠글 대상을 {@code group_join_requests}로 잡을 수
	 * 없는 것은 아직 없는 행이 경쟁 대상이기 때문이며, 두 트랜잭션이 반드시 만나는 기존 행은
	 * 신청자 계정뿐이다.
	 *
	 * <p>그룹 행도 잠가 삭제와 직렬화한다. 잠그지 않으면 그룹 삭제가 가입 요청을 지운 뒤 이 요청이
	 * 같은 그룹에 새 행을 넣어, 삭제의 마지막 단계가 외래 키 제약에 걸리거나 사라진 그룹을 가리키는
	 * 요청이 남는다. 초대 코드로 그룹을 찾는 첫 조회는 잠그지 않는다. 공통 잠금 순서가 계정 행을
	 * 먼저 요구하므로 잠금은 계정 다음에 획득한다. 그 사이 그룹이 삭제되면 잠금 조회가 비어
	 * 초대 코드 오류로 끝난다.
	 */
	@Transactional
	public JoinRequestCreateResponse createByInviteCode(
		Long authenticatedUserId,
		JoinRequestCreateRequest request) {
		Long groupId = familyGroupRepository.findByInviteCode(normalizeInviteCode(request.inviteCode()))
			.map(FamilyGroup::getId)
			.orElseThrow(() -> new BusinessException(ErrorCode.INVITE_CODE_INVALID));
		User applicant = userRepository.findActiveByIdForUpdate(authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
		familyGroupRepository.lockForGroupScopeChange(groupId)
			.orElseThrow(() -> new BusinessException(ErrorCode.INVITE_CODE_INVALID));
		FamilyGroup group = familyGroupRepository.findById(groupId)
			.orElseThrow(() -> new BusinessException(ErrorCode.INVITE_CODE_INVALID));

		if (groupMemberRepository.findActiveByGroupIdAndUserId(group.getId(), authenticatedUserId).isPresent()) {
			throw new BusinessException(ErrorCode.ALREADY_GROUP_MEMBER);
		}
		if (groupJoinRequestRepository.existsByGroupIdAndApplicantIdAndStatus(
			group.getId(), authenticatedUserId, JoinRequestStatus.PENDING_ADMIN)) {
			throw new BusinessException(ErrorCode.JOIN_REQUEST_ALREADY_EXISTS);
		}

		GroupJoinRequest joinRequest = savePendingRequest(
			new GroupJoinRequest(group, applicant, JoinRequestStatus.PENDING_ADMIN));
		eventPublisher.publishEvent(new DomainNotificationEvent.JoinRequestCreated(joinRequest.getId()));

		return new JoinRequestCreateResponse(
			joinRequest.getId(), group.getId(), group.getName(), joinRequest.getStatus());
	}

	/**
	 * 대기 중 가입 요청을 저장하면서 제약 위반을 계약된 오류로 바꾼다.
	 *
	 * <p>트랜잭션 안에서 flush해야 위반을 여기서 잡을 수 있다. 커밋 시점까지 미루면 예외가 서비스
	 * 밖에서 올라와 계약에 없는 500이 된다.
	 */
	private GroupJoinRequest savePendingRequest(GroupJoinRequest joinRequest) {
		try {
			return groupJoinRequestRepository.saveAndFlush(joinRequest);
		} catch (DataIntegrityViolationException exception) {
			if (constraintViolationTranslator.isPendingJoinRequest(exception)) {
				throw new BusinessException(ErrorCode.JOIN_REQUEST_ALREADY_EXISTS);
			}
			throw exception;
		}
	}

	@Transactional(readOnly = true)
	public JoinRequestListResponse getJoinRequests(Long groupId, Long authenticatedUserId, String status) {
		requireActiveManager(groupId, authenticatedUserId);

		List<GroupJoinRequest> requests = status == null
			? groupJoinRequestRepository.findAllWithApplicantByGroupId(groupId)
			: groupJoinRequestRepository.findAllWithApplicantByGroupIdAndStatus(groupId, parseStatus(status));

		return new JoinRequestListResponse(requests.stream()
			.map(request -> new JoinRequestItemResponse(
				request.getId(),
				request.getApplicant().getId(),
				request.getApplicant().getName(),
				mediaDownloadUrlProvider.issueProfileImageDownloadUrl(
					request.getApplicant().getProfileImageUrl()),
				request.getStatus(),
				request.getAssignedRole(),
				request.getProcessedAt(),
				request.getCreatedAt()))
			.toList());
	}

	/**
	 * 관리자가 대기 중 가입 요청을 승인하거나 거절한다.
	 *
	 * <p>신청자 계정, 그룹, 가입 요청 순으로 잠근다. 그룹 행을 잠그는 것은 그룹 삭제와
	 * 직렬화하기 위해서다. 잠그지 않으면 삭제가 활성 인원을 확인한 뒤 이 승인이 커밋되어, 삭제의
	 * 일괄 삭제가 방금 승인된 구성원까지 지운다. 승인 200과 삭제 204가 모두 성공하는데 멤버십은
	 * 사라지는 상태가 된다. 삭제가 먼저 커밋되면 잠금 뒤 가입 요청 조회가 비어 404로 끝난다.
	 */
	@Transactional
	public JoinRequestDecisionResponse decide(
		Long groupId,
		Long joinRequestId,
		Long authenticatedUserId,
		JoinRequestDecisionRequest request) {
		GroupMember manager = requireActiveManager(groupId, authenticatedUserId);

		String decision = normalizeDecision(request.decision());
		lockApplicantAccount(joinRequestId, groupId);
		familyGroupRepository.lockForGroupScopeChange(groupId)
			.orElseThrow(() -> new BusinessException(ErrorCode.JOIN_REQUEST_NOT_FOUND));
		GroupJoinRequest joinRequest = groupJoinRequestRepository
			.findForUpdateByIdAndGroupId(joinRequestId, groupId)
			.filter(candidate -> candidate.getApplicant().getWithdrawnAt() == null)
			.orElseThrow(() -> new BusinessException(ErrorCode.JOIN_REQUEST_NOT_FOUND));
		if (!joinRequest.isPending()) {
			throw new BusinessException(ErrorCode.JOIN_REQUEST_ALREADY_PROCESSED);
		}

		if (DECISION_REJECT.equals(decision)) {
			joinRequest.reject(Instant.now());
			eventPublisher.publishEvent(new DomainNotificationEvent.JoinRequestDecided(
				joinRequest.getId(),
				manager.getUser().getId(),
				DomainNotificationEvent.Decision.REJECTED));
			return new JoinRequestDecisionResponse(joinRequest.getId(), joinRequest.getStatus(), null, null);
		}

		GroupRole assignedRole = request.assignedRole();
		if (assignedRole == null) {
			throw new BusinessException(ErrorCode.ASSIGNED_ROLE_REQUIRED);
		}

		GroupMember member = approveMembership(joinRequest, assignedRole);
		joinRequest.approve(assignedRole, Instant.now());
		eventPublisher.publishEvent(new DomainNotificationEvent.JoinRequestDecided(
			joinRequest.getId(),
			manager.getUser().getId(),
			DomainNotificationEvent.Decision.APPROVED));

		return new JoinRequestDecisionResponse(
			joinRequest.getId(), joinRequest.getStatus(), member.getId(), assignedRole);
	}

	/**
	 * 승인된 신청자의 멤버십을 만들거나 기존 행을 재활성화한다.
	 *
	 * <p>같은 그룹·사용자 조합은 유니크하므로 과거에 탈퇴한 이력이 있으면 새 행을 만들지 않는다.
	 */
	private GroupMember approveMembership(GroupJoinRequest joinRequest, GroupRole assignedRole) {
		Long applicantUserId = joinRequest.getApplicant().getId();
		if (assignedRole == GroupRole.CARE_RECEIVER && isActiveCareReceiver(applicantUserId)) {
			throw new BusinessException(ErrorCode.CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP);
		}

		Instant now = Instant.now();
		GroupMember membership = groupMemberRepository
			.findByGroupIdAndUserId(joinRequest.getGroup().getId(), applicantUserId)
			.map(existing -> {
				if (existing.isActive()) {
					throw new BusinessException(ErrorCode.ALREADY_GROUP_MEMBER);
				}
				existing.rejoin(assignedRole, now);
				return existing;
			})
			.orElseGet(() -> new GroupMember(
				joinRequest.getGroup(), joinRequest.getApplicant(), assignedRole, false, now));

		return saveMembership(membership);
	}

	/**
	 * 신청자 계정 행을 잠근 뒤에 확인하므로 잠그지 않고 읽어도 된다.
	 *
	 * <p>피보호자를 지정하는 모든 경로가 대상 계정 행을 먼저 잠그므로, 이 조회 시점에는 같은
	 * 사용자를 다른 그룹의 피보호자로 만드는 트랜잭션이 동시에 진행될 수 없다.
	 */
	private boolean isActiveCareReceiver(Long userId) {
		return groupMemberRepository.findAllActiveByUserId(userId).stream()
			.anyMatch(membership -> membership.getRole() == GroupRole.CARE_RECEIVER);
	}

	/**
	 * 결정 대상 요청의 신청자 계정 행을 요청 행보다 먼저 잠근다.
	 *
	 * <p>계정 행이 서로 다른 그룹의 두 승인 트랜잭션이 반드시 만나는 유일한 기존 행이므로, 이
	 * 잠금이 활성 피보호자 검사와 멤버십 쓰기를 직렬화한다. 요청이나 신청자를 찾지 못하면 잠그지
	 * 않고 넘어가 뒤따르는 조회가 기존 404·권한 판정을 그대로 내리게 한다.
	 */
	private void lockApplicantAccount(Long joinRequestId, Long groupId) {
		groupJoinRequestRepository.findApplicantUserIdByIdAndGroupId(joinRequestId, groupId)
			.ifPresent(userRepository::findActiveByIdForUpdate);
	}

	/**
	 * 멤버십을 저장하면서 활성 피보호자 제약 위반을 계약된 오류로 바꾼다.
	 *
	 * <p>재가입은 더티체킹으로 UPDATE되므로 명시적으로 flush해야 위반을 여기서 잡을 수 있다.
	 */
	private GroupMember saveMembership(GroupMember membership) {
		try {
			return groupMemberRepository.saveAndFlush(membership);
		} catch (DataIntegrityViolationException exception) {
			if (constraintViolationTranslator.isActiveCareReceiver(exception)) {
				throw new BusinessException(ErrorCode.CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP);
			}
			throw exception;
		}
	}

	private GroupMember requireActiveManager(Long groupId, Long authenticatedUserId) {
		GroupMember requester = groupMemberRepository
			.findActiveByGroupIdAndUserId(groupId, authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.NOT_GROUP_MANAGER));
		if (!requester.isManager()) {
			throw new BusinessException(ErrorCode.NOT_GROUP_MANAGER);
		}
		return requester;
	}

	private String normalizeInviteCode(String inviteCode) {
		if (inviteCode == null) {
			throw new BusinessException(ErrorCode.INVITE_CODE_INVALID);
		}

		String normalized = inviteCode.trim().toUpperCase(Locale.ROOT);
		if (normalized.isEmpty()) {
			throw new BusinessException(ErrorCode.INVITE_CODE_INVALID);
		}
		return normalized;
	}

	private String normalizeDecision(String decision) {
		if (decision == null) {
			throw new BusinessException(ErrorCode.INVALID_JOIN_REQUEST_DECISION);
		}

		String normalized = decision.trim().toUpperCase(Locale.ROOT);
		if (!DECISION_APPROVE.equals(normalized) && !DECISION_REJECT.equals(normalized)) {
			throw new BusinessException(ErrorCode.INVALID_JOIN_REQUEST_DECISION);
		}
		return normalized;
	}

	private JoinRequestStatus parseStatus(String status) {
		try {
			return JoinRequestStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
		} catch (IllegalArgumentException exception) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
	}
}
