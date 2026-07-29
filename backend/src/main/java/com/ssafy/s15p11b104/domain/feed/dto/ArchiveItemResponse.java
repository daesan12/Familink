package com.ssafy.s15p11b104.domain.feed.dto;

public record ArchiveItemResponse(
	Long postId,
	PostArchiveType type,
	String thumbnailUrl,
	String contentPreview) {
}
