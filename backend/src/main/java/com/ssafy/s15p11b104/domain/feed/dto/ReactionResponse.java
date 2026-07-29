package com.ssafy.s15p11b104.domain.feed.dto;

import java.util.Map;

import com.ssafy.s15p11b104.domain.feed.entity.ReactionType;

public record ReactionResponse(
	Long postId,
	ReactionType reactionType,
	Map<ReactionType, Long> counts) {
}
