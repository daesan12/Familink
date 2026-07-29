package com.ssafy.s15p11b104.domain.feed.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.ssafy.s15p11b104.domain.feed.entity.ReactionType;

public record PostListItem(
	Long id,
	PostAuthorResponse author,
	String content,
	List<PostMediaResponse> media,
	Map<ReactionType, Long> reactionCounts,
	ReactionType myReaction,
	long commentCount,
	Instant createdAt) {
}
