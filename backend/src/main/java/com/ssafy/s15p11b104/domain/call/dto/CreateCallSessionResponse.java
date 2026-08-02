package com.ssafy.s15p11b104.domain.call.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record CreateCallSessionResponse(
	@JsonProperty("call_session_id")
	Long callSessionId,

	@JsonProperty("sdp_answer")
	String sdpAnswer
) {
}
