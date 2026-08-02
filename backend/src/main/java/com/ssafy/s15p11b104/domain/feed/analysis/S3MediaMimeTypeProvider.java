package com.ssafy.s15p11b104.domain.feed.analysis;

import java.net.URI;

import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.domain.file.config.S3Properties;

import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;

@Component
public class S3MediaMimeTypeProvider implements MediaMimeTypeProvider {

	private final S3Client s3Client;
	private final S3Properties properties;

	public S3MediaMimeTypeProvider(S3Client s3Client, S3Properties properties) {
		this.s3Client = s3Client;
		this.properties = properties;
	}

	@Override
	public String getMimeType(String mediaUri) {
		URI uri = parseAllowedUri(mediaUri);
		if (uri == null) {
			return null;
		}

		String objectKey = objectKey(uri);
		if (objectKey == null) {
			return null;
		}

		HeadObjectRequest request = HeadObjectRequest.builder()
			.bucket(properties.bucket())
			.key(objectKey)
			.build();
		return s3Client.headObject(request).contentType();
	}

	private URI parseAllowedUri(String mediaUri) {
		if (mediaUri == null || mediaUri.isBlank()) {
			return null;
		}
		try {
			URI uri = URI.create(mediaUri);
			return properties.isAllowedUri(uri) ? uri : null;
		} catch (IllegalArgumentException exception) {
			return null;
		}
	}

	private String objectKey(URI uri) {
		String path = uri.getPath();
		if (path == null || path.isBlank() || "/".equals(path)) {
			return null;
		}

		String objectKey = path.startsWith("/") ? path.substring(1) : path;
		if (isConfiguredEndpoint(uri)) {
			String bucketPrefix = endpointPathPrefix() + properties.bucket() + "/";
			if (!objectKey.startsWith(bucketPrefix)) {
				return null;
			}
			objectKey = objectKey.substring(bucketPrefix.length());
		}
		return objectKey.isBlank() ? null : objectKey;
	}

	private boolean isConfiguredEndpoint(URI uri) {
		if (properties.endpoint() == null || properties.endpoint().isBlank()) {
			return false;
		}
		try {
			return uri.getHost().equals(URI.create(properties.endpoint()).getHost());
		} catch (IllegalArgumentException exception) {
			return false;
		}
	}

	private String endpointPathPrefix() {
		String path = URI.create(properties.endpoint()).getPath();
		if (path == null || path.isBlank() || "/".equals(path)) {
			return "";
		}
		String prefix = path.startsWith("/") ? path.substring(1) : path;
		return prefix.endsWith("/") ? prefix : prefix + "/";
	}
}
