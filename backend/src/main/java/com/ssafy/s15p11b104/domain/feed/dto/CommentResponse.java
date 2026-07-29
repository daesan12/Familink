package com.ssafy.s15p11b104.domain.feed.dto;

import java.time.Instant;

public record CommentResponse(
	Long id,
	PostAuthorResponse author,
	String content,
	Instant createdAt,
	Instant updatedAt) {
}
