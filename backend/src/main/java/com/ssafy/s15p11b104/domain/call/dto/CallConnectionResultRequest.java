package com.ssafy.s15p11b104.domain.call.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CallConnectionResultRequest(
	@NotNull
	ConnectionResult result,

	@JsonProperty("error_code")
	@Size(max = 100)
	String errorCode
) {
}
