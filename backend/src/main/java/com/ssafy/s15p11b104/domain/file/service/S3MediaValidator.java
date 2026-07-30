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
		String key = keyResolver.resolve(mediaUrl).orElseThrow(this::invalidMedia);
		HeadObjectResponse metadata;
		try {
			metadata = s3Client.headObject(HeadObjectRequest.builder()
				.bucket(s3Properties.bucket())
				.key(key)
				.build());
		} catch (S3Exception | SdkClientException exception) {
			throw invalidMedia();
		}

		if (metadata.contentLength() <= 0 || metadata.contentLength() > mediaProperties.maxSizeBytes(mediaType)
			|| !mediaProperties.allows(mediaType, metadata.contentType())) {
			throw invalidMedia();
		}

		if (mediaType == MediaType.VIDEO) {
			validateVideoDuration(key);
		}
	}

	private void validateVideoDuration(String key) {
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
			if (duration.signum() < 0
				|| duration.compareTo(BigDecimal.valueOf(mediaProperties.videoMaxDurationSeconds())) > 0) {
				throw invalidMedia();
			}
		} catch (IOException | S3Exception | SdkClientException | IllegalStateException exception) {
			throw invalidMedia();
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

	private BusinessException invalidMedia() {
		return new BusinessException(ErrorCode.INVALID_REQUEST);
	}
}
