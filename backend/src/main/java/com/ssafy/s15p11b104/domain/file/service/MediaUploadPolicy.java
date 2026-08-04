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
			throw invalidRequest("files", "업로드할 파일을 선택해 주세요.");
		}
		List<FileUploadRequest> normalized = files.stream().map(this::normalize).toList();
		switch (purpose) {
			case POST_MEDIA_PURPOSE -> validatePostMedia(normalized);
			case PROFILE_IMAGE_PURPOSE -> validateProfileImage(normalized);
			default -> throw invalidRequest("purpose", "지원하지 않는 파일 업로드 목적입니다.");
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
				throw invalidRequest("files", "사진과 영상은 한 게시글에 함께 올릴 수 없습니다.");
			}
			validateSize(file, mediaType);
		}
		if (mediaType == MediaType.IMAGE && files.size() > MAX_POST_IMAGE_COUNT) {
			throw invalidRequest("files", "사진은 한 게시글에 최대 4장까지 올릴 수 있습니다.");
		}
		if (mediaType == MediaType.VIDEO && files.size() != 1) {
			throw invalidRequest("files", "영상은 한 게시글에 1개만 올릴 수 있습니다.");
		}
	}

	private void validateProfileImage(List<FileUploadRequest> files) {
		if (files.size() != 1) {
			throw invalidRequest("files", "프로필 사진은 1장만 선택해 주세요.");
		}
		FileUploadRequest file = files.get(0);
		if (requiredMediaType(file) != MediaType.IMAGE) {
			throw invalidRequest("files.contentType", "프로필에는 사진 파일만 올릴 수 있습니다.");
		}
		validateSize(file, MediaType.IMAGE);
	}

	private MediaType requiredMediaType(FileUploadRequest file) {
		MediaType mediaType = mediaType(file.contentType());
		if (mediaType == null) {
			throw invalidRequest(
				"files.contentType",
				"사진은 JPEG, PNG, WebP 형식, 영상은 MP4 형식만 올릴 수 있습니다.");
		}
		return mediaType;
	}

	private void validateSize(FileUploadRequest file, MediaType mediaType) {
		if (file.sizeBytes() > properties.maxSizeBytes(mediaType)) {
			String message = mediaType == MediaType.IMAGE
				? "사진은 파일당 10MB 이하만 올릴 수 있습니다."
				: "영상은 파일당 100MB 이하만 올릴 수 있습니다.";
			throw invalidRequest("files.sizeBytes", message);
		}
	}

	private BusinessException invalidRequest(String field, String message) {
		return new BusinessException(ErrorCode.INVALID_REQUEST, field, message);
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
