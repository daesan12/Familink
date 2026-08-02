package com.ssafy.s15p11b104.domain.group.service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.group.dto.InterestReplaceRequest;
import com.ssafy.s15p11b104.domain.group.dto.InterestResponse;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.entity.MemberInterest;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.group.repository.MemberInterestRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

@Service
public class MemberInterestService {

	private static final int MAX_INTEREST_COUNT = 10;
	private static final int MAX_INTEREST_LENGTH = 10;

	private final GroupMemberRepository groupMemberRepository;
	private final MemberInterestRepository memberInterestRepository;

	public MemberInterestService(
		GroupMemberRepository groupMemberRepository,
		MemberInterestRepository memberInterestRepository) {
		this.groupMemberRepository = groupMemberRepository;
		this.memberInterestRepository = memberInterestRepository;
	}

	@Transactional(readOnly = true)
	public InterestResponse getInterests(Long groupId, Long memberId, Long authenticatedUserId) {
		GroupMember targetMember = getActiveMember(groupId, memberId);
		GroupMember requester = getActiveMemberByUser(groupId, authenticatedUserId);
		validateReadPermission(targetMember, requester, authenticatedUserId);

		List<String> interests = memberInterestRepository.findAllByCareReceiverMemberIdOrderById(memberId)
			.stream()
			.map(MemberInterest::getInterestText)
			.toList();
		return new InterestResponse(memberId, interests);
	}

	/**
	 * 대상 구성원의 관심사를 요청 목록으로 전체 교체한다.
	 *
	 * <p>구성원 행을 잠그고 시작한다. 잠그지 않으면 빈 목록에 서로 다른 목록을 동시에 저장할 때
	 * 두 트랜잭션의 삭제가 각각 0건이 되어 양쪽 삽입이 모두 남는다. 그 결과 최대 20개가 남아
	 * 0~10개 전체 교체 계약을 깨고, 겹치는 문자열은 {@code uq_member_interests_member_text}
	 * 위반으로 실패한다. 잠글 대상을 관심사 행으로 잡을 수 없는 것은 아직 없는 행이 경쟁 대상이기
	 * 때문이며, 두 트랜잭션이 반드시 만나는 기존 행은 구성원 행뿐이다.
	 */
	@Transactional
	public InterestResponse replaceInterests(
		Long groupId,
		Long memberId,
		Long authenticatedUserId,
		InterestReplaceRequest request) {
		GroupMember targetMember = getActiveMemberForUpdate(groupId, memberId);
		validateWritePermission(targetMember, authenticatedUserId);

		List<String> normalizedInterests = normalize(request.interests());
		memberInterestRepository.deleteAllByCareReceiverMemberId(memberId);
		memberInterestRepository.flush();

		List<MemberInterest> interests = normalizedInterests.stream()
			.map(interest -> new MemberInterest(targetMember, interest))
			.toList();
		memberInterestRepository.saveAll(interests);
		return new InterestResponse(memberId, normalizedInterests);
	}

	private GroupMember getActiveMember(Long groupId, Long memberId) {
		return groupMemberRepository.findActiveByGroupIdAndMemberId(groupId, memberId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	/**
	 * 관심사를 교체할 구성원 행을 잠그고 찾는다.
	 *
	 * <p>잠금 조회는 활성 조건을 걸지 않으므로 잠근 뒤 활성 여부를 다시 확인한다. 이미 떠난
	 * 구성원을 거부하는 기존 동작은 그대로다.
	 */
	private GroupMember getActiveMemberForUpdate(Long groupId, Long memberId) {
		GroupMember member = groupMemberRepository.findForUpdateByGroupIdAndMemberId(groupId, memberId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
		if (!member.isActive()) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}
		return member;
	}

	private GroupMember getActiveMemberByUser(Long groupId, Long userId) {
		return groupMemberRepository.findActiveByGroupIdAndUserId(groupId, userId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	private void validateReadPermission(
		GroupMember targetMember,
		GroupMember requester,
		Long authenticatedUserId) {
		if (targetMember.getRole() != GroupRole.CARE_RECEIVER) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}

		boolean isTargetSelf = targetMember.getUser().getId().equals(authenticatedUserId);
		boolean isActiveGuardian = requester.getRole() == GroupRole.GUARDIAN;
		if (!isTargetSelf && !isActiveGuardian) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}
	}

	private void validateWritePermission(GroupMember targetMember, Long authenticatedUserId) {
		boolean isCareReceiver = targetMember.getRole() == GroupRole.CARE_RECEIVER;
		boolean isTargetSelf = targetMember.getUser().getId().equals(authenticatedUserId);
		if (!isCareReceiver || !isTargetSelf) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}
	}

	private List<String> normalize(List<String> interests) {
		LinkedHashSet<String> uniqueInterests = new LinkedHashSet<>();
		for (String interest : interests) {
			if (interest == null) {
				throw new BusinessException(ErrorCode.INVALID_REQUEST);
			}

			String normalized = interest.trim();
			if (normalized.isEmpty() || normalized.length() > MAX_INTEREST_LENGTH) {
				throw new BusinessException(ErrorCode.INVALID_REQUEST);
			}
			uniqueInterests.add(normalized);
			if (uniqueInterests.size() > MAX_INTEREST_COUNT) {
				throw new BusinessException(ErrorCode.INVALID_REQUEST);
			}
		}
		return new ArrayList<>(uniqueInterests);
	}
}
