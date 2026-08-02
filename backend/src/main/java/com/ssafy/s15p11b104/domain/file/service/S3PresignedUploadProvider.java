package com.ssafy.s15p11b104.domain.file.service;

import java.time.Instant;
import java.util.Map;
import java.util.Locale;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.domain.file.config.S3Properties;
import com.ssafy.s15p11b104.domain.file.dto.FileUploadRequest;
import com.ssafy.s15p11b104.domain.file.dto.UploadResponse;

import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@Component
public class S3PresignedUploadProvider implements PresignedUploadProvider {

	private final S3Presigner presigner;
	private final S3Properties properties;

	public S3PresignedUploadProvider(S3Presigner presigner, S3Properties properties) {
		this.presigner = presigner;
		this.properties = properties;
	}

	@Override
	public UploadResponse issue(String purpose, FileUploadRequest file) {
		String objectKey = purpose.toLowerCase(Locale.ROOT) + "/" + UUID.randomUUID() + extension(file.fileName());
		PutObjectRequest putObjectRequest = PutObjectRequest.builder()
			.bucket(properties.bucket())
			.key(objectKey)
			.contentType(file.contentType())
			.contentLength(file.sizeBytes())
			.build();
		PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
			.signatureDuration(properties.presignedUrlDuration())
			.putObjectRequest(putObjectRequest)
			.build();

		var presigned = presigner.presignPutObject(presignRequest);
		Instant expiresAt = Instant.now().plus(properties.presignedUrlDuration());
		return new UploadResponse(
			presigned.url().toString(),
			fileUrl(objectKey),
			Map.of(
				"Content-Type", file.contentType(),
				"Content-Length", String.valueOf(file.sizeBytes())),
			expiresAt);
	}

	private String fileUrl(String objectKey) {
		String encodedKey = objectKey;
		if (properties.endpoint() == null || properties.endpoint().isBlank()) {
			return "https://" + properties.bucket() + ".s3." + properties.region() + ".amazonaws.com/" + encodedKey;
		}
		return properties.endpoint().replaceAll("/$", "") + "/" + properties.bucket() + "/" + encodedKey;
	}

	private String extension(String fileName) {
		int dot = fileName.lastIndexOf('.');
		if (dot <= 0 || dot == fileName.length() - 1) {
			return "";
		}
		String extension = fileName.substring(dot + 1).toLowerCase();
		return extension.matches("[a-z0-9]{1,10}") ? "." + extension : "";
	}
}
