package com.ssafy.s15p11b104.domain.group.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.group.dto.GroupCreateRequest;
import com.ssafy.s15p11b104.domain.group.dto.GroupCreateResponse;
import com.ssafy.s15p11b104.domain.group.dto.GroupDeleteRequest;
import com.ssafy.s15p11b104.domain.group.dto.GroupDetailResponse;
import com.ssafy.s15p11b104.domain.group.dto.GroupListResponse;
import com.ssafy.s15p11b104.domain.group.dto.GroupSummaryResponse;
import com.ssafy.s15p11b104.domain.group.dto.GroupUpdateRequest;
import com.ssafy.s15p11b104.domain.group.dto.GroupUpdateResponse;
import com.ssafy.s15p11b104.domain.group.dto.JoinRequestSummaryResponse;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupJoinRequestRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

import jakarta.persistence.EntityManager;

@Service
public class GroupService {

	private static final int MAX_GROUP_NAME_LENGTH = 10;
	private static final int INVITE_CODE_LENGTH = 6;
	private static final int INVITE_CODE_MAX_ATTEMPTS = 10;
	private static final String INVITE_CODE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

	private final FamilyGroupRepository familyGroupRepository;
	private final GroupMemberRepository groupMemberRepository;
	private final GroupJoinRequestRepository groupJoinRequestRepository;
	private final UserRepository userRepository;
	private final EntityManager entityManager;
	private final SecureRandom secureRandom = new SecureRandom();

	public GroupService(
		FamilyGroupRepository familyGroupRepository,
		GroupMemberRepository groupMemberRepository,
		GroupJoinRequestRepository groupJoinRequestRepository,
		UserRepository userRepository,
		EntityManager entityManager) {
		this.familyGroupRepository = familyGroupRepository;
		this.groupMemberRepository = groupMemberRepository;
		this.groupJoinRequestRepository = groupJoinRequestRepository;
		this.userRepository = userRepository;
		this.entityManager = entityManager;
	}

	@Transactional(readOnly = true)
	public GroupListResponse getMyGroups(Long authenticatedUserId) {
		List<GroupMember> memberships = groupMemberRepository
			.findAllActiveWithGroupByUserId(authenticatedUserId);
		Map<Long, Long> memberCounts = countActiveMembers(memberships);

		List<GroupSummaryResponse> groups = memberships.stream()
			.map(membership -> new GroupSummaryResponse(
				membership.getGroup().getId(),
				membership.getGroup().getName(),
				membership.getId(),
				membership.getRole(),
				memberCounts.getOrDefault(membership.getGroup().getId(), 0L),
				membership.isManager()))
			.toList();

		List<JoinRequestSummaryResponse> joinRequests = groupJoinRequestRepository
			.findAllWithGroupByApplicantUserId(authenticatedUserId)
			.stream()
			.map(request -> new JoinRequestSummaryResponse(
				request.getId(),
				request.getGroup().getId(),
				request.getGroup().getName(),
				request.getStatus(),
				request.getCreatedAt(),
				request.getProcessedAt()))
			.toList();

		return new GroupListResponse(groups, joinRequests);
	}

	@Transactional
	public GroupCreateResponse create(Long authenticatedUserId, GroupCreateRequest request) {
		String name = normalizeName(request.name());
		if (request.myRole() == GroupRole.CARE_RECEIVER && isActiveCareReceiver(authenticatedUserId)) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}

		User creator = userRepository.findByIdAndWithdrawnAtIsNull(authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
		FamilyGroup group = familyGroupRepository.save(new FamilyGroup(name, generateInviteCode()));
		GroupMember manager = groupMemberRepository.save(
			new GroupMember(group, creator, request.myRole(), true, Instant.now()));

		return new GroupCreateResponse(
			group.getId(), manager.getId(), group.getInviteCode(), group.getCreatedAt());
	}

	@Transactional(readOnly = true)
	public GroupDetailResponse getDetail(Long groupId, Long authenticatedUserId) {
		List<GroupMember> activeMembers = groupMemberRepository.findAllActiveByGroupId(groupId);
		GroupMember requester = findRequester(activeMembers, authenticatedUserId);

		Long managerMemberId = activeMembers.stream()
			.filter(GroupMember::isManager)
			.map(GroupMember::getId)
			.findFirst()
			.orElse(null);
		long guardianCount = countByRole(activeMembers, GroupRole.GUARDIAN);
		long careReceiverCount = countByRole(activeMembers, GroupRole.CARE_RECEIVER);

		return new GroupDetailResponse(
			requester.getGroup().getId(),
			requester.getGroup().getName(),
			managerMemberId,
			requester.isManager(),
			guardianCount,
			careReceiverCount,
			activeMembers.size());
	}

	@Transactional
	public GroupUpdateResponse update(Long groupId, Long authenticatedUserId, GroupUpdateRequest request) {
		GroupMember requester = getActiveManager(groupId, authenticatedUserId);
		String name = normalizeName(request.name());

		FamilyGroup group = requester.getGroup();
		group.rename(name);
		familyGroupRepository.flush();

		return new GroupUpdateResponse(group.getId(), group.getName(), group.getUpdatedAt());
	}

	@Transactional
	public void delete(Long groupId, Long authenticatedUserId, GroupDeleteRequest request) {
		GroupMember requester = getActiveManager(groupId, authenticatedUserId);

		List<GroupMember> activeMembers = groupMemberRepository.findAllActiveByGroupId(groupId);
		if (activeMembers.size() > 1) {
			throw new BusinessException(ErrorCode.GROUP_HAS_ACTIVE_MEMBERS);
		}
		if (!requester.getGroup().getName().equals(request.confirmationName().trim())) {
			throw new BusinessException(ErrorCode.GROUP_NAME_MISMATCH);
		}

		deleteGroupData(groupId);
	}

	/**
	 * 그룹과 그룹에 종속된 데이터를 FK 제약을 위반하지 않는 순서로 하드 삭제한다.
	 *
	 * <p>posts·calendar_events·call_sessions의 자식 테이블과 notifications의 관련 컬럼은
	 * 스키마의 ON DELETE CASCADE·SET NULL로 함께 정리된다.
	 */
	private void deleteGroupData(Long groupId) {
		entityManager.flush();
		List<String> statements = List.of(
			"DELETE FROM member_interests WHERE care_receiver_member_id IN "
				+ "(SELECT id FROM group_members WHERE group_id = :groupId)",
			"DELETE FROM member_aliases WHERE group_id = :groupId",
			"DELETE FROM posts WHERE group_id = :groupId",
			"DELETE FROM calendar_events WHERE group_id = :groupId",
			"DELETE FROM call_sessions WHERE group_id = :groupId",
			"DELETE FROM daily_reports WHERE group_id = :groupId",
			"DELETE FROM carnations WHERE group_id = :groupId",
			"DELETE FROM group_join_requests WHERE group_id = :groupId",
			"DELETE FROM group_members WHERE group_id = :groupId",
			"DELETE FROM family_groups WHERE id = :groupId");
		for (String statement : statements) {
			entityManager.createNativeQuery(statement)
				.setParameter("groupId", groupId)
				.executeUpdate();
		}
		entityManager.clear();
	}

	private GroupMember getActiveManager(Long groupId, Long authenticatedUserId) {
		GroupMember requester = groupMemberRepository
			.findActiveByGroupIdAndUserId(groupId, authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
		if (!requester.isManager()) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}
		return requester;
	}

	/**
	 * 피보호자는 동시에 하나의 활성 그룹에만 참여할 수 있다는 규칙을 미리 확인한다.
	 *
	 * <p>최종 보장은 {@code uq_user_active_care_receiver} 부분 유니크 인덱스가 담당한다.
	 */
	private boolean isActiveCareReceiver(Long userId) {
		return groupMemberRepository.findAllActiveByUserId(userId).stream()
			.anyMatch(membership -> membership.getRole() == GroupRole.CARE_RECEIVER);
	}

	private GroupMember findRequester(List<GroupMember> activeMembers, Long authenticatedUserId) {
		return activeMembers.stream()
			.filter(member -> member.getUser().getId().equals(authenticatedUserId))
			.findFirst()
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	private Map<Long, Long> countActiveMembers(List<GroupMember> memberships) {
		List<Long> groupIds = memberships.stream()
			.map(membership -> membership.getGroup().getId())
			.toList();
		if (groupIds.isEmpty()) {
			return Map.of();
		}
		return groupMemberRepository.countActiveByGroupIds(groupIds).stream()
			.collect(Collectors.toMap(
				GroupMemberRepository.ActiveMemberCount::getGroupId,
				GroupMemberRepository.ActiveMemberCount::getMemberCount));
	}

	private long countByRole(List<GroupMember> members, GroupRole role) {
		return members.stream()
			.filter(member -> member.getRole() == role)
			.count();
	}

	private String normalizeName(String name) {
		String normalized = name.trim();
		if (normalized.isEmpty() || normalized.length() > MAX_GROUP_NAME_LENGTH) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		return normalized;
	}

	private String generateInviteCode() {
		for (int attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt++) {
			StringBuilder code = new StringBuilder(INVITE_CODE_LENGTH);
			for (int index = 0; index < INVITE_CODE_LENGTH; index++) {
				code.append(INVITE_CODE_CHARACTERS.charAt(
					secureRandom.nextInt(INVITE_CODE_CHARACTERS.length())));
			}
			String candidate = code.toString();
			if (!familyGroupRepository.existsByInviteCode(candidate)) {
				return candidate;
			}
		}
		throw new IllegalStateException("초대 코드 생성에 반복해서 실패했습니다.");
	}
}
