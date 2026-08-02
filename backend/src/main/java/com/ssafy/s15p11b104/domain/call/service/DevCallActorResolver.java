package com.ssafy.s15p11b104.domain.call.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.domain.call.repository.GroupMemberCallRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;

@Component
@Profile("ai-call-dev")
public class DevCallActorResolver implements CallActorResolver {

	private final GroupMemberCallRepository groupMemberRepository;
	private final String careReceiverLoginId;

	public DevCallActorResolver(
		GroupMemberCallRepository groupMemberRepository,
		@Value("${app.ai-call.dev.care-receiver-login-id}") String careReceiverLoginId
	) {
		this.groupMemberRepository = groupMemberRepository;
		this.careReceiverLoginId = careReceiverLoginId;
	}

	@Override
	public CallActor resolve() {
		GroupMember member = groupMemberRepository.findActiveCareReceiverByLoginId(
			careReceiverLoginId,
			GroupRole.CARE_RECEIVER
		)
			.orElseThrow(() -> CallApiException.unauthorized("AI 전화 개발 사용자를 찾을 수 없습니다."));
		return new CallActor(member.getId());
	}
}
