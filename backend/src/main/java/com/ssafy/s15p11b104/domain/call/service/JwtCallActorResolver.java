package com.ssafy.s15p11b104.domain.call.service;

import org.springframework.context.annotation.Profile;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.domain.call.repository.GroupMemberCallRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

/**
 * 인증된 사용자의 활성 피보호자 멤버십을 통화 주체로 해석한다.
 *
 * <p>활성 피보호자 멤버십은 {@code uq_user_active_care_receiver} 부분 유니크 인덱스가
 * 사용자당 최대 1건을 보장하므로 단건 조회로 확정할 수 있다.
 */
@Component
@Profile("!ai-call-dev")
public class JwtCallActorResolver implements CallActorResolver {

	private final GroupMemberCallRepository groupMemberRepository;

	public JwtCallActorResolver(GroupMemberCallRepository groupMemberRepository) {
		this.groupMemberRepository = groupMemberRepository;
	}

	@Override
	public CallActor resolve() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) {
			throw CallApiException.unauthorized("인증이 필요합니다.");
		}
		GroupMember member = groupMemberRepository.findActiveCareReceiverByUserId(user.id())
			.orElseThrow(() -> CallApiException.forbidden("AI 전화는 피보호자만 사용할 수 있습니다."));
		return new CallActor(member.getId());
	}
}
