package com.ssafy.s15p11b104.domain.group.service;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
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
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

@Service
public class JoinRequestService {

	private static final String DECISION_APPROVE = "APPROVE";
	private static final String DECISION_REJECT = "REJECT";

	private final FamilyGroupRepository familyGroupRepository;
	private final GroupMemberRepository groupMemberRepository;
	private final GroupJoinRequestRepository groupJoinRequestRepository;
	private final UserRepository userRepository;

	public JoinRequestService(
		FamilyGroupRepository familyGroupRepository,
		GroupMemberRepository groupMemberRepository,
		GroupJoinRequestRepository groupJoinRequestRepository,
		UserRepository userRepository) {
		this.familyGroupRepository = familyGroupRepository;
		this.groupMemberRepository = groupMemberRepository;
		this.groupJoinRequestRepository = groupJoinRequestRepository;
		this.userRepository = userRepository;
	}

	@Transactional
	public JoinRequestCreateResponse createByInviteCode(
		Long authenticatedUserId,
		JoinRequestCreateRequest request) {
		FamilyGroup group = familyGroupRepository.findByInviteCode(normalizeInviteCode(request.inviteCode()))
			.orElseThrow(() -> new BusinessException(ErrorCode.INVITE_CODE_INVALID));

		if (groupMemberRepository.findActiveByGroupIdAndUserId(group.getId(), authenticatedUserId).isPresent()) {
			throw new BusinessException(ErrorCode.ALREADY_GROUP_MEMBER);
		}
		if (groupJoinRequestRepository.existsByGroupIdAndApplicantIdAndStatus(
			group.getId(), authenticatedUserId, JoinRequestStatus.PENDING_ADMIN)) {
			throw new BusinessException(ErrorCode.JOIN_REQUEST_ALREADY_EXISTS);
		}

		User applicant = userRepository.findByIdAndWithdrawnAtIsNull(authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
		GroupJoinRequest joinRequest = groupJoinRequestRepository.save(
			new GroupJoinRequest(group, applicant, JoinRequestStatus.PENDING_ADMIN));

		return new JoinRequestCreateResponse(
			joinRequest.getId(), group.getId(), group.getName(), joinRequest.getStatus());
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
				request.getApplicant().getProfileImageUrl(),
				request.getStatus(),
				request.getAssignedRole(),
				request.getProcessedAt(),
				request.getCreatedAt()))
			.toList());
	}

	@Transactional
	public JoinRequestDecisionResponse decide(
		Long groupId,
		Long joinRequestId,
		Long authenticatedUserId,
		JoinRequestDecisionRequest request) {
		requireActiveManager(groupId, authenticatedUserId);

		String decision = normalizeDecision(request.decision());
		GroupJoinRequest joinRequest = groupJoinRequestRepository
			.findForUpdateByIdAndGroupId(joinRequestId, groupId)
			.filter(candidate -> candidate.getApplicant().getWithdrawnAt() == null)
			.orElseThrow(() -> new BusinessException(ErrorCode.JOIN_REQUEST_NOT_FOUND));
		if (!joinRequest.isPending()) {
			throw new BusinessException(ErrorCode.JOIN_REQUEST_ALREADY_PROCESSED);
		}

		if (DECISION_REJECT.equals(decision)) {
			joinRequest.reject(Instant.now());
			return new JoinRequestDecisionResponse(joinRequest.getId(), joinRequest.getStatus(), null, null);
		}

		GroupRole assignedRole = request.assignedRole();
		if (assignedRole == null) {
			throw new BusinessException(ErrorCode.ASSIGNED_ROLE_REQUIRED);
		}

		GroupMember member = approveMembership(joinRequest, assignedRole);
		joinRequest.approve(assignedRole, Instant.now());

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
		return groupMemberRepository
			.findByGroupIdAndUserId(joinRequest.getGroup().getId(), applicantUserId)
			.map(existing -> {
				if (existing.isActive()) {
					throw new BusinessException(ErrorCode.ALREADY_GROUP_MEMBER);
				}
				existing.rejoin(assignedRole, now);
				return existing;
			})
			.orElseGet(() -> groupMemberRepository.save(new GroupMember(
				joinRequest.getGroup(), joinRequest.getApplicant(), assignedRole, false, now)));
	}

	private boolean isActiveCareReceiver(Long userId) {
		return groupMemberRepository.findAllActiveByUserId(userId).stream()
			.anyMatch(membership -> membership.getRole() == GroupRole.CARE_RECEIVER);
	}

	private void requireActiveManager(Long groupId, Long authenticatedUserId) {
		GroupMember requester = groupMemberRepository
			.findActiveByGroupIdAndUserId(groupId, authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.NOT_GROUP_MANAGER));
		if (!requester.isManager()) {
			throw new BusinessException(ErrorCode.NOT_GROUP_MANAGER);
		}
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
