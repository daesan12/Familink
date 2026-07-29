package com.ssafy.s15p11b104.domain.feed.dto;

import com.ssafy.s15p11b104.domain.feed.entity.MediaType;
import com.ssafy.s15p11b104.domain.feed.entity.PostMedia;

public record PostMediaResponse(
	Long id,
	MediaType type,
	String fileUrl,
	String thumbnailUrl,
	int displayOrder) {

	public static PostMediaResponse from(PostMedia media) {
		return new PostMediaResponse(
			media.getId(),
			media.getMediaType(),
			media.getFileUrl(),
			media.getThumbnailUrl(),
			media.getDisplayOrder());
	}
}
