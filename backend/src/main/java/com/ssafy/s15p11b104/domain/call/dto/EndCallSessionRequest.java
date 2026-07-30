package com.ssafy.s15p11b104.domain.call.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record EndCallSessionRequest(
	@JsonProperty("termination_type")
	CallTerminationType terminationType
) {

	public CallTerminationType resolveTerminationType() {
		return terminationType == null ? CallTerminationType.USER_REQUESTED : terminationType;
	}
}
