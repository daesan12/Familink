package com.ssafy.s15p11b104.domain.feed.dto;

import java.time.Instant;

public record CommentCreateResponse(
	Long id,
	Long postId,
	String content,
	Instant createdAt) {
}
