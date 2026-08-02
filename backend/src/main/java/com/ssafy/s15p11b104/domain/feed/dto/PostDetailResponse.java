package com.ssafy.s15p11b104.domain.feed.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.ssafy.s15p11b104.domain.feed.entity.ReactionType;

public record PostDetailResponse(
	Long id,
	Long groupId,
	PostAuthorResponse author,
	String content,
	List<PostMediaResponse> media,
	Map<ReactionType, Long> reactions,
	long commentCount,
	Instant createdAt,
	Instant updatedAt) {
}
