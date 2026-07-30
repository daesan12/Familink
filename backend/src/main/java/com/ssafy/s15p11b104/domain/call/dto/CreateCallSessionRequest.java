package com.ssafy.s15p11b104.domain.call.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateCallSessionRequest(
	@JsonProperty("persona_id")
	@NotNull
	@Min(1)
	@Max(6)
	Long personaId,

	@JsonProperty("sdp_offer")
	@NotBlank
	@Size(max = 200_000)
	String sdpOffer
) {
}
