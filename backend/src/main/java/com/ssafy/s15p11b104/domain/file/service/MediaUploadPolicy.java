package com.ssafy.s15p11b104.domain.file.service;

import java.util.List;
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
	private static final String PROFILE_IMAGE_PURPOSE = "profile-image";
	private static final int MAX_POST_IMAGE_COUNT = 4;

	private final MediaUploadProperties properties;

	public MediaUploadPolicy(MediaUploadProperties properties) {
		this.properties = properties;
	}

	public List<FileUploadRequest> validate(String purpose, List<FileUploadRequest> files) {
		if (files == null || files.isEmpty()) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		List<FileUploadRequest> normalized = files.stream().map(this::normalize).toList();
		switch (purpose) {
			case POST_MEDIA_PURPOSE -> validatePostMedia(normalized);
			case PROFILE_IMAGE_PURPOSE -> validateProfileImage(normalized);
			default -> throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		return normalized;
	}

	private FileUploadRequest normalize(FileUploadRequest file) {
		String normalizedContentType = file.contentType().split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
		return new FileUploadRequest(file.fileName(), normalizedContentType, file.sizeBytes());
	}

	private void validatePostMedia(List<FileUploadRequest> files) {
		MediaType mediaType = requiredMediaType(files.get(0));
		for (FileUploadRequest file : files) {
			if (requiredMediaType(file) != mediaType) {
				throw new BusinessException(ErrorCode.INVALID_REQUEST);
			}
			validateSize(file, mediaType);
		}
		if (mediaType == MediaType.IMAGE && files.size() > MAX_POST_IMAGE_COUNT) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		if (mediaType == MediaType.VIDEO && files.size() != 1) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
	}

	private void validateProfileImage(List<FileUploadRequest> files) {
		if (files.size() != 1) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		FileUploadRequest file = files.get(0);
		if (requiredMediaType(file) != MediaType.IMAGE) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		validateSize(file, MediaType.IMAGE);
	}

	private MediaType requiredMediaType(FileUploadRequest file) {
		MediaType mediaType = mediaType(file.contentType());
		if (mediaType == null) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		return mediaType;
	}

	private void validateSize(FileUploadRequest file, MediaType mediaType) {
		if (file.sizeBytes() > properties.maxSizeBytes(mediaType)) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
	}

	private MediaType mediaType(String contentType) {
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
