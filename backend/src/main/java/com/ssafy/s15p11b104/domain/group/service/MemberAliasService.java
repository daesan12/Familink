package com.ssafy.s15p11b104.domain.group.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.group.dto.AliasResponse;
import com.ssafy.s15p11b104.domain.group.dto.AliasUpdateRequest;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.MemberAlias;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.group.repository.MemberAliasRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

@Service
public class MemberAliasService {

	private static final int MAX_ALIAS_LENGTH = 10;

	private final GroupMemberRepository groupMemberRepository;
	private final MemberAliasRepository memberAliasRepository;

	public MemberAliasService(
		GroupMemberRepository groupMemberRepository,
		MemberAliasRepository memberAliasRepository) {
		this.groupMemberRepository = groupMemberRepository;
		this.memberAliasRepository = memberAliasRepository;
	}

	@Transactional
	public AliasResponse updateAlias(
		Long groupId,
		Long targetMemberId,
		Long authenticatedUserId,
		AliasUpdateRequest request) {
		GroupMember ownerMember = getActiveMemberByUser(groupId, authenticatedUserId);
		GroupMember targetMember = getActiveMember(groupId, targetMemberId);
		if (ownerMember.getId().equals(targetMember.getId())) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}

		String normalizedAlias = normalize(request.alias());
		MemberAlias memberAlias = memberAliasRepository
			.findByGroupIdAndOwnerMemberIdAndTargetMemberId(
				groupId, ownerMember.getId(), targetMember.getId())
			.orElseGet(() -> new MemberAlias(
				ownerMember.getGroup(), ownerMember, targetMember, normalizedAlias));
		memberAlias.updateAlias(normalizedAlias);
		memberAliasRepository.save(memberAlias);

		return new AliasResponse(targetMember.getId(), normalizedAlias);
	}

	private GroupMember getActiveMember(Long groupId, Long memberId) {
		return groupMemberRepository.findActiveByGroupIdAndMemberId(groupId, memberId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	private GroupMember getActiveMemberByUser(Long groupId, Long userId) {
		return groupMemberRepository.findActiveByGroupIdAndUserId(groupId, userId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	private String normalize(String alias) {
		if (alias == null) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}

		String normalized = alias.trim();
		if (normalized.isEmpty() || normalized.length() > MAX_ALIAS_LENGTH) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		return normalized;
	}
}
