package com.ssafy.s15p11b104.domain.feed.dto;

import com.ssafy.s15p11b104.domain.feed.entity.ReactionType;

import jakarta.validation.constraints.NotNull;

public record ReactionRequest(
	@NotNull ReactionType reactionType) {
}
