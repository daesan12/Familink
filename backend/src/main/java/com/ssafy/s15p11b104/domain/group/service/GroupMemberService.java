package com.ssafy.s15p11b104.domain.group.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.file.service.MediaDownloadUrlProvider;
import com.ssafy.s15p11b104.domain.group.dto.GroupMemberItemResponse;
import com.ssafy.s15p11b104.domain.group.dto.GroupMemberListResponse;
import com.ssafy.s15p11b104.domain.group.dto.ManagerUpdateRequest;
import com.ssafy.s15p11b104.domain.group.dto.ManagerUpdateResponse;
import com.ssafy.s15p11b104.domain.group.dto.MemberProfileResponse;
import com.ssafy.s15p11b104.domain.group.dto.MemberRoleUpdateRequest;
import com.ssafy.s15p11b104.domain.group.dto.MemberRoleUpdateResponse;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.entity.MemberAlias;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.group.repository.MemberAliasRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ConstraintViolationTranslator;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

/**
 * 그룹 구성원 조회와 관리자의 구성원 관리 작업을 처리한다.
 *
 * <p>그룹 자체의 수명주기는 {@link GroupService}, 가입 요청은 {@link JoinRequestService}가
 * 담당한다.
 */
@Service
public class GroupMemberService {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");

	private final GroupMemberRepository groupMemberRepository;
	private final MemberAliasRepository memberAliasRepository;
	private final UserRepository userRepository;
	private final ConstraintViolationTranslator constraintViolationTranslator;
	private final MediaDownloadUrlProvider mediaDownloadUrlProvider;

	public GroupMemberService(
		GroupMemberRepository groupMemberRepository,
		MemberAliasRepository memberAliasRepository,
		UserRepository userRepository,
		ConstraintViolationTranslator constraintViolationTranslator,
		MediaDownloadUrlProvider mediaDownloadUrlProvider) {
		this.groupMemberRepository = groupMemberRepository;
		this.memberAliasRepository = memberAliasRepository;
		this.userRepository = userRepository;
		this.constraintViolationTranslator = constraintViolationTranslator;
		this.mediaDownloadUrlProvider = mediaDownloadUrlProvider;
	}

	/**
	 * 그룹의 활성 구성원 목록을 조회자 기준 표시 이름으로 반환한다.
	 *
	 * @param role 지정하면 해당 역할만 반환하고, {@code null}이면 전체를 반환한다
	 */
	@Transactional(readOnly = true)
	public GroupMemberListResponse getMembers(Long groupId, Long authenticatedUserId, GroupRole role) {
		List<GroupMember> activeMembers = groupMemberRepository.findAllActiveByGroupId(groupId);
		GroupMember viewer = findViewer(activeMembers, authenticatedUserId);

		List<GroupMember> targets = activeMembers.stream()
			.filter(member -> role == null || member.getRole() == role)
			.sorted(Comparator.comparing(GroupMember::getId))
			.toList();
		Map<Long, String> aliases = aliasesByTarget(groupId, viewer, targets);

		return new GroupMemberListResponse(targets.stream()
			.map(member -> new GroupMemberItemResponse(
				member.getId(),
				member.getUser().getId(),
				displayName(aliases, member),
				mediaDownloadUrlProvider.issueProfileImageDownloadUrl(member.getUser().getProfileImageUrl()),
				member.getRole(),
				member.isManager()))
			.toList());
	}

	/**
	 * 같은 그룹 활성 구성원에게 공개하는 축소 프로필을 조회한다.
	 *
	 * <p>나이는 KST 기준 만 나이다. 생년월일과 성별을 아직 입력하지 않은 사용자는 해당 값이
	 * {@code null}이다. 탈퇴한 사용자는 활성 멤버십이 함께 종료되므로 여기서 조회되지 않는다.
	 */
	@Transactional(readOnly = true)
	public MemberProfileResponse getMemberProfile(Long groupId, Long memberId, Long authenticatedUserId) {
		GroupMember viewer = groupMemberRepository.findActiveByGroupIdAndUserId(groupId, authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.NOT_GROUP_MEMBER));
		GroupMember target = groupMemberRepository.findActiveByGroupIdAndMemberId(groupId, memberId)
			.orElseThrow(() -> new BusinessException(ErrorCode.GROUP_MEMBER_NOT_FOUND));

		User user = target.getUser();
		String alias = memberAliasRepository
			.findByGroupIdAndOwnerMemberIdAndTargetMemberId(groupId, viewer.getId(), target.getId())
			.map(MemberAlias::getAlias)
			.orElse(user.getName());

		return new MemberProfileResponse(target.getId(), alias, age(user.getBirthDate()), user.getGender());
	}

	/**
	 * 관리자가 활성 구성원의 역할을 변경한다.
	 *
	 * <p>{@code role}과 관리자 여부는 독립된 축이므로 관리자 본인의 역할도 변경할 수 있다.
	 *
	 * <p>피보호자로 바꿀 때는 대상 계정 행을 멤버십 행보다 먼저 잠근다. 활성 피보호자 제약은
	 * 그룹을 가로지르므로 그룹별 멤버십 행을 잠그는 것만으로는 서로 다른 그룹의 두 요청이
	 * 직렬화되지 않고, 아직 없는 멤버십을 잠글 수도 없다. 두 요청이 반드시 만나는 기존 행은
	 * 대상 계정뿐이다.
	 */
	@Transactional
	public MemberRoleUpdateResponse changeRole(
		Long groupId,
		Long memberId,
		Long authenticatedUserId,
		MemberRoleUpdateRequest request) {
		GroupRole role = request.role();
		if (role == GroupRole.CARE_RECEIVER) {
			lockMemberAccount(groupId, memberId);
		}

		requireActiveManager(groupId, authenticatedUserId);
		GroupMember target = getManageableMember(groupId, memberId);

		if (role == GroupRole.CARE_RECEIVER && hasOtherActiveCareReceiverMembership(target)) {
			throw new BusinessException(ErrorCode.CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP);
		}
		target.changeRole(role);
		flushRoleChange();

		return new MemberRoleUpdateResponse(groupId, target.getId(), role);
	}

	/**
	 * 관리자 권한을 다른 활성 구성원에게 위임한다.
	 *
	 * <p>{@code uq_group_active_manager}가 그룹당 활성 관리자를 한 명으로 제한하므로 기존
	 * 관리자를 해제하고 flush한 뒤 새 관리자를 지정한다. 두 변경을 한 번에 flush하면 순서에
	 * 따라 관리자가 일시적으로 두 명이 되어 인덱스를 위반한다.
	 *
	 * <p>새 관리자로 본인을 지정하면 변경 없이 현재 상태를 반환한다.
	 */
	@Transactional
	public ManagerUpdateResponse changeManager(
		Long groupId,
		Long authenticatedUserId,
		ManagerUpdateRequest request) {
		GroupMember currentManager = requireActiveManager(groupId, authenticatedUserId);
		GroupMember newManager = getManageableMember(groupId, request.newManagerMemberId());
		if (currentManager.getId().equals(newManager.getId())) {
			return new ManagerUpdateResponse(groupId, currentManager.getId());
		}

		currentManager.assignManager(false);
		groupMemberRepository.flush();
		newManager.assignManager(true);
		groupMemberRepository.flush();

		return new ManagerUpdateResponse(groupId, newManager.getId());
	}

	/**
	 * 관리자가 다른 활성 구성원을 그룹에서 내보낸다.
	 *
	 * <p>탈퇴와 동일하게 행을 삭제하지 않고 {@code left_at}만 기록해 과거 연결 데이터를
	 * 보존한다. 관리자 없는 그룹이 생기지 않도록 본인은 내보낼 수 없다.
	 */
	@Transactional
	public void removeMember(Long groupId, Long memberId, Long authenticatedUserId) {
		GroupMember requester = requireActiveManager(groupId, authenticatedUserId);
		GroupMember target = getManageableMember(groupId, memberId);
		if (requester.getId().equals(target.getId())) {
			throw new BusinessException(ErrorCode.CANNOT_REMOVE_SELF);
		}

		target.leave(Instant.now());
	}

	/**
	 * 요청자가 그룹의 활성 관리자인지 확인하고 그 행을 잠근다.
	 *
	 * <p>관리자만 수행하는 역할 변경·관리자 위임·내보내기가 모두 같은 행을 잠그므로 그룹
	 * 단위로 직렬화된다. 동시에 두 요청이 관리자를 위임해 활성 관리자가 사라지거나 둘이 되는
	 * 상태를 막는다.
	 */
	private GroupMember requireActiveManager(Long groupId, Long authenticatedUserId) {
		GroupMember requester = groupMemberRepository
			.findActiveForUpdateByGroupIdAndUserId(groupId, authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
		if (!requester.isManager()) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}
		return requester;
	}

	/**
	 * 관리 대상 구성원 행을 잠그고 찾으면서 존재하지 않는 경우와 이미 떠난 경우를 구분한다.
	 *
	 * <p>대상을 잠그지 않으면 대상이 같은 시점에 그룹을 떠나거나 회원 탈퇴할 때 두 트랜잭션이
	 * 서로의 변경을 덮어쓴다. 특히 위임과 탈퇴가 겹치면 승격된 관리자에게 {@code left_at}이
	 * 기록되어 활성 관리자가 없는 그룹이 남고, 모든 관리자 API가 막혀 복구할 수 없다.
	 */
	private GroupMember getManageableMember(Long groupId, Long memberId) {
		GroupMember member = groupMemberRepository.findForUpdateByGroupIdAndMemberId(groupId, memberId)
			.orElseThrow(() -> new BusinessException(ErrorCode.GROUP_MEMBER_NOT_FOUND));
		if (!member.isActive()) {
			throw new BusinessException(ErrorCode.GROUP_MEMBER_ALREADY_LEFT);
		}
		return member;
	}

	/**
	 * 대상 구성원을 제외한 다른 그룹에서 이미 활성 피보호자인지 확인한다.
	 *
	 * <p>대상 자신을 함께 세면 같은 그룹의 기존 피보호자를 다시 피보호자로 지정할 때 잘못된
	 * 충돌이 발생한다.
	 *
	 * <p>대상 계정 행을 잠근 뒤에 확인하므로 잠그지 않고 읽어도 된다. 피보호자를 지정하는 모든
	 * 경로가 대상 계정 행을 먼저 잠그므로 이 조회 시점에 경쟁 트랜잭션이 진행될 수 없다. 그래도
	 * {@code uq_user_active_care_receiver}가 최종 방어를 담당하며, 위반은
	 * {@link #flushRoleChange()}가 계약된 409로 바꾼다.
	 */
	private boolean hasOtherActiveCareReceiverMembership(GroupMember target) {
		return groupMemberRepository.findAllActiveByUserId(target.getUser().getId()).stream()
			.filter(membership -> !membership.getId().equals(target.getId()))
			.anyMatch(membership -> membership.getRole() == GroupRole.CARE_RECEIVER);
	}

	/**
	 * 대상 구성원의 계정 행을 멤버십 행보다 먼저 잠근다.
	 *
	 * <p>잠글 계정을 알아내는 조회는 잠그지 않는다. 구성원을 찾지 못하면 잠그지 않고 넘어가
	 * 뒤따르는 권한 검사와 404·409 판정을 앞지르지 않는다.
	 */
	private void lockMemberAccount(Long groupId, Long memberId) {
		groupMemberRepository.findUserIdByGroupIdAndMemberId(groupId, memberId)
			.ifPresent(userRepository::findActiveByIdForUpdate);
	}

	/**
	 * 역할 변경을 트랜잭션 안에서 flush하고 제약 위반을 계약된 오류로 바꾼다.
	 *
	 * <p>더티체킹에만 맡기면 위반이 커밋 시점에 올라와 서비스에서 잡을 수 없고, 계약에 없는 500이
	 * 된다.
	 */
	private void flushRoleChange() {
		try {
			groupMemberRepository.flush();
		} catch (DataIntegrityViolationException exception) {
			if (constraintViolationTranslator.isActiveCareReceiver(exception)) {
				throw new BusinessException(ErrorCode.CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP);
			}
			throw exception;
		}
	}

	private GroupMember findViewer(List<GroupMember> activeMembers, Long authenticatedUserId) {
		return activeMembers.stream()
			.filter(member -> member.getUser().getId().equals(authenticatedUserId))
			.findFirst()
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	private Map<Long, String> aliasesByTarget(Long groupId, GroupMember viewer, List<GroupMember> targets) {
		if (targets.isEmpty()) {
			return Map.of();
		}
		return memberAliasRepository.findAllByGroupIdAndOwnerMemberIdAndTargetMemberIdIn(
				groupId,
				viewer.getId(),
				targets.stream().map(GroupMember::getId).toList())
			.stream()
			.collect(Collectors.toMap(alias -> alias.getTargetMember().getId(), MemberAlias::getAlias));
	}

	private String displayName(Map<Long, String> aliases, GroupMember member) {
		return aliases.getOrDefault(member.getId(), member.getUser().getName());
	}

	private Integer age(LocalDate birthDate) {
		if (birthDate == null) {
			return null;
		}
		return Period.between(birthDate, LocalDate.now(BUSINESS_ZONE)).getYears();
	}
}
