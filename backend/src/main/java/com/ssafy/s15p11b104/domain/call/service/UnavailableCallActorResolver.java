package com.ssafy.s15p11b104.domain.call.service;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("!ai-call-dev")
public class UnavailableCallActorResolver implements CallActorResolver {

	@Override
	public CallActor resolve() {
		throw CallApiException.unauthorized("인증이 필요합니다.");
	}
}
