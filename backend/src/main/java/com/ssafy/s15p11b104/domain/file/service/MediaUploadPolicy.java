package com.ssafy.s15p11b104.domain.file.service;

import java.util.Locale;

import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.domain.feed.entity.MediaType;
import com.ssafy.s15p11b104.domain.file.config.MediaUploadProperties;
import com.ssafy.s15p11b104.domain.file.dto.FileUploadRequest;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

@Component
public class MediaUploadPolicy {

	private static final String POST_MEDIA_PURPOSE = "post-media";

	private final MediaUploadProperties properties;

	public MediaUploadPolicy(MediaUploadProperties properties) {
		this.properties = properties;
	}

	public void validatePresignedRequest(String purpose, FileUploadRequest file) {
		if (!POST_MEDIA_PURPOSE.equalsIgnoreCase(purpose)) {
			return;
		}

		MediaType mediaType = mediaType(file.contentType());
		if (mediaType == null || file.sizeBytes() > properties.maxSizeBytes(mediaType)) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
	}

	public MediaType mediaType(String contentType) {
		if (contentType == null) {
			return null;
		}
		String normalized = contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
		if (properties.allowedImageTypes().contains(normalized)) {
			return MediaType.IMAGE;
		}
		if (properties.allowedVideoTypes().contains(normalized)) {
			return MediaType.VIDEO;
		}
		return null;
	}
}
