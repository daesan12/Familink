package com.ssafy.s15p11b104.domain.file.service;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;

import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.domain.feed.entity.MediaType;
import com.ssafy.s15p11b104.domain.file.config.MediaUploadProperties;
import com.ssafy.s15p11b104.domain.file.config.S3Properties;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Component
public class S3MediaValidator {

	private final S3Client s3Client;
	private final S3Properties s3Properties;
	private final MediaUploadProperties mediaProperties;
	private final S3ObjectKeyResolver keyResolver;
	private final VideoDurationProvider videoDurationProvider;

	public S3MediaValidator(
		S3Client s3Client,
		S3Properties s3Properties,
		MediaUploadProperties mediaProperties,
		S3ObjectKeyResolver keyResolver,
		VideoDurationProvider videoDurationProvider) {
		this.s3Client = s3Client;
		this.s3Properties = s3Properties;
		this.mediaProperties = mediaProperties;
		this.keyResolver = keyResolver;
		this.videoDurationProvider = videoDurationProvider;
	}

	public void validate(MediaType mediaType, String mediaUrl) {
		String key = keyResolver.resolve(mediaUrl)
			.orElseThrow(() -> invalidMedia("media.fileUrl", "올바른 업로드 파일 주소가 아닙니다."));
		validateObject(mediaType, key, "media.fileUrl");
	}

	public void validateThumbnail(String thumbnailUrl) {
		String key = keyResolver.resolve(thumbnailUrl)
			.orElseThrow(() -> invalidMedia("media.thumbnailUrl", "올바른 썸네일 주소가 아닙니다."));
		validateObject(MediaType.IMAGE, key, "media.thumbnailUrl");
	}

	public void validateProfileImage(String profileImageUrl) {
		String key = keyResolver.resolveProfileImage(profileImageUrl)
			.orElseThrow(() -> invalidMedia("profileImageUrl", "올바른 프로필 사진 주소가 아닙니다."));
		validateObject(MediaType.IMAGE, key, "profileImageUrl");
	}

	private void validateObject(MediaType mediaType, String key, String field) {
		HeadObjectResponse metadata;
		try {
			metadata = s3Client.headObject(HeadObjectRequest.builder()
				.bucket(s3Properties.bucket())
				.key(key)
				.build());
		} catch (S3Exception | SdkClientException exception) {
			throw invalidMedia(field, "업로드된 파일을 확인하지 못했습니다. 파일을 다시 선택해 주세요.");
		}

		if (metadata.contentLength() <= 0) {
			throw invalidMedia(field, "내용이 없는 파일은 올릴 수 없습니다.");
		}
		if (metadata.contentLength() > mediaProperties.maxSizeBytes(mediaType)) {
			String message = mediaType == MediaType.IMAGE
				? "사진은 파일당 10MB 이하만 올릴 수 있습니다."
				: "영상은 파일당 100MB 이하만 올릴 수 있습니다.";
			throw invalidMedia(field, message);
		}
		if (!mediaProperties.allows(mediaType, metadata.contentType())) {
			String message = mediaType == MediaType.IMAGE
				? "사진은 JPEG, PNG, WebP 형식만 올릴 수 있습니다."
				: "영상은 MP4 형식만 올릴 수 있습니다.";
			throw invalidMedia(field, message);
		}

		if (mediaType == MediaType.VIDEO) {
			validateVideoDuration(key, field);
		}
	}

	private void validateVideoDuration(String key, String field) {
		Path temporaryFile = null;
		try {
			temporaryFile = Files.createTempFile("s15p11b104-video-", ".mp4");
			GetObjectRequest request = GetObjectRequest.builder()
				.bucket(s3Properties.bucket())
				.key(key)
				.build();
			try (ResponseInputStream<GetObjectResponse> input = s3Client.getObject(request)) {
				Files.copy(input, temporaryFile, StandardCopyOption.REPLACE_EXISTING);
			}
			BigDecimal duration = videoDurationProvider.durationSeconds(temporaryFile);
			if (duration.signum() < 0) {
				throw invalidMedia(field, "영상 재생 시간을 확인할 수 없습니다.");
			}
			if (duration.compareTo(BigDecimal.valueOf(mediaProperties.videoMaxDurationSeconds())) > 0) {
				throw invalidMedia(
					field,
					"영상은 최대 " + mediaProperties.videoMaxDurationSeconds() + "초까지 올릴 수 있습니다.");
			}
		} catch (IOException | S3Exception | SdkClientException | IllegalStateException exception) {
			throw invalidMedia(field, "영상을 검사하지 못했습니다. 파일을 다시 선택해 주세요.");
		} finally {
			if (temporaryFile != null) {
				try {
					Files.deleteIfExists(temporaryFile);
				} catch (IOException ignored) {
					// Temporary files are best-effort cleanup; the validation result is already determined.
				}
			}
		}
	}

	private BusinessException invalidMedia(String field, String message) {
		return new BusinessException(ErrorCode.INVALID_REQUEST, field, message);
	}
}
