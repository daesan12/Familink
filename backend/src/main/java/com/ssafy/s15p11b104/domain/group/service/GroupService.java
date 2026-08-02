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
import com.ssafy.s15p11b104.domain.group.dto.InviteCodeResponse;
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

	/**
	 * 로그인한 사용자가 자신의 역할을 정해 그룹을 만들고 그 그룹의 관리자가 된다.
	 *
	 * <p>생성자 계정 행을 먼저 잠근 뒤 활성 피보호자 여부를 확인한다. 활성 피보호자 제약은 그룹을
	 * 가로지르므로, 잠그지 않으면 그룹 생성과 다른 그룹의 피보호자 지정이 양쪽 사전 검사를 통과한
	 * 뒤 {@code uq_user_active_care_receiver}에서 한쪽이 실패한다. 피보호자를 지정하는 모든 경로가
	 * 같은 계정 행을 먼저 잠그므로 그 위반 자체가 생기지 않는다.
	 *
	 * <p>같은 잠금이 회원 탈퇴와의 경쟁도 막는다. 잠그지 않으면 활성 여부를 확인한 뒤 탈퇴가
	 * 커밋되어도 새 관리자 멤버십이 삽입되어, 다시 인증할 수 없는 탈퇴자가 유일 관리자인 그룹이
	 * 남는다. 그런 그룹은 관리자 API가 모두 막혀 삭제도 위임도 할 수 없다. 잠금 조회에 활성 조건이
	 * 포함되어 있어 탈퇴가 먼저 커밋되면 여기서 인증 오류로 끝난다.
	 */
	@Transactional
	public GroupCreateResponse create(Long authenticatedUserId, GroupCreateRequest request) {
		String name = normalizeName(request.name());
		User creator = userRepository.findActiveByIdForUpdate(authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
		if (request.myRole() == GroupRole.CARE_RECEIVER && isActiveCareReceiver(authenticatedUserId)) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}

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

	@Transactional(readOnly = true)
	public InviteCodeResponse getInviteCode(Long groupId, Long authenticatedUserId) {
		GroupMember requester = getActiveMember(groupId, authenticatedUserId);
		return new InviteCodeResponse(requester.getGroup().getInviteCode());
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
	 * 본인 멤버십을 비활성화해 그룹에서 탈퇴한다.
	 *
	 * <p>행을 삭제하지 않고 {@code left_at}만 기록해 과거 연결 데이터를 보존한다. 관리자는
	 * 관리자 없는 그룹이 생기지 않도록 이 API로 탈퇴할 수 없다. 다른 구성원이 있으면 먼저
	 * 위임하고, 혼자 남은 관리자는 탈퇴 대신 그룹 삭제 절차를 사용한다.
	 *
	 * <p>자기 멤버십 행을 잠그고 읽어 관리자 여부를 판정한다. 잠그지 않으면 관리자 위임이
	 * 이 사용자를 관리자로 승격시키는 트랜잭션과 겹칠 때 두 변경이 서로를 덮어써, 승격된
	 * 관리자가 이미 떠난 상태로 남고 활성 관리자가 없는 그룹이 만들어진다.
	 */
	@Transactional
	public void leave(Long groupId, Long authenticatedUserId) {
		GroupMember membership = groupMemberRepository
			.findActiveForUpdateByGroupIdAndUserId(groupId, authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
		if (membership.isManager()) {
			throw new BusinessException(ErrorCode.MANAGER_TRANSFER_REQUIRED);
		}

		membership.leave(Instant.now());
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

	private GroupMember getActiveMember(Long groupId, Long authenticatedUserId) {
		return groupMemberRepository
			.findActiveByGroupIdAndUserId(groupId, authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	private GroupMember getActiveManager(Long groupId, Long authenticatedUserId) {
		GroupMember requester = getActiveMember(groupId, authenticatedUserId);
		if (!requester.isManager()) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}
		return requester;
	}

	/**
	 * 피보호자는 동시에 하나의 활성 그룹에만 참여할 수 있다는 규칙을 미리 확인한다.
	 *
	 * <p>호출자가 대상 계정 행을 잠근 뒤에 확인하므로 잠그지 않고 읽어도 된다. 최종 보장은
	 * {@code uq_user_active_care_receiver} 부분 유니크 인덱스가 담당한다.
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
