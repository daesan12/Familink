package com.ssafy.s15p11b104.domain.file.service;

import java.net.URI;

import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.domain.file.config.S3Properties;

import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

@Component
public class S3MediaDownloadUrlProvider implements MediaDownloadUrlProvider {

	private final S3Presigner presigner;
	private final S3Properties properties;

	public S3MediaDownloadUrlProvider(S3Presigner presigner, S3Properties properties) {
		this.presigner = presigner;
		this.properties = properties;
	}

	@Override
	public String issueDownloadUrl(String storedFileUrl) {
		URI uri = parseUri(storedFileUrl);
		if (!properties.isAllowedUri(uri)) {
			throw new IllegalArgumentException("Stored URL is not allowed");
		}
		if (!isCanonicalS3Uri(uri)) {
			return storedFileUrl;
		}

		GetObjectRequest getObjectRequest = GetObjectRequest.builder()
			.bucket(properties.bucket())
			.key(objectKey(uri))
			.build();
		GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
			.signatureDuration(properties.downloadUrlDuration())
			.getObjectRequest(getObjectRequest)
			.build();
		return presigner.presignGetObject(presignRequest).url().toString();
	}

	private URI parseUri(String storedFileUrl) {
		try {
			return URI.create(storedFileUrl);
		} catch (IllegalArgumentException exception) {
			throw new IllegalArgumentException("Invalid stored S3 URL", exception);
		}
	}

	private boolean isCanonicalS3Uri(URI uri) {
		if (properties.endpoint() == null || properties.endpoint().isBlank()) {
			return (properties.bucket() + ".s3." + properties.region() + ".amazonaws.com")
				.equals(uri.getHost());
		}
		try {
			return URI.create(properties.endpoint()).getHost().equals(uri.getHost());
		} catch (IllegalArgumentException exception) {
			return false;
		}
	}

	private String objectKey(URI uri) {
		String path = uri.getPath();
		if (path == null || path.isBlank()) {
			throw new IllegalArgumentException("Stored URL has no object key");
		}
		String normalizedPath = path.startsWith("/") ? path.substring(1) : path;
		if (properties.endpoint() != null && !properties.endpoint().isBlank()) {
			String endpointPath = endpointPathPrefix();
			if (!endpointPath.isBlank()) {
				if (!normalizedPath.startsWith(endpointPath + "/")) {
					throw new IllegalArgumentException("Stored URL endpoint path does not match configuration");
				}
				normalizedPath = normalizedPath.substring(endpointPath.length() + 1);
			}
			String bucketPrefix = properties.bucket() + "/";
			if (!normalizedPath.startsWith(bucketPrefix)) {
				throw new IllegalArgumentException("Stored URL bucket does not match configuration");
			}
			normalizedPath = normalizedPath.substring(bucketPrefix.length());
		}
		if (normalizedPath.isBlank()) {
			throw new IllegalArgumentException("Stored URL has no object key");
		}
		return normalizedPath;
	}

	private String endpointPathPrefix() {
		try {
			String endpointPath = URI.create(properties.endpoint()).getPath();
			if (endpointPath == null || endpointPath.isBlank() || "/".equals(endpointPath)) {
				return "";
			}
			String normalizedPath = endpointPath.startsWith("/") ? endpointPath.substring(1) : endpointPath;
			return normalizedPath.replaceAll("/+$", "");
		} catch (IllegalArgumentException exception) {
			throw new IllegalArgumentException("Invalid S3 endpoint", exception);
		}
	}
}
