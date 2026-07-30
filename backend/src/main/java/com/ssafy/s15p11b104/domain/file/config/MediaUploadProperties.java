package com.ssafy.s15p11b104.domain.file.config;

import java.util.List;
import java.util.Locale;

import org.springframework.boot.context.properties.ConfigurationProperties;

import com.ssafy.s15p11b104.domain.feed.entity.MediaType;

@ConfigurationProperties(prefix = "app.media")
public record MediaUploadProperties(
	long imageMaxSizeBytes,
	long videoMaxSizeBytes,
	long videoMaxDurationSeconds,
	List<String> allowedImageTypes,
	List<String> allowedVideoTypes,
	String ffprobePath) {

	private static final long DEFAULT_IMAGE_MAX_SIZE_BYTES = 10L * 1024 * 1024;
	private static final long DEFAULT_VIDEO_MAX_SIZE_BYTES = 100L * 1024 * 1024;
	private static final long DEFAULT_VIDEO_MAX_DURATION_SECONDS = 60L;

	public MediaUploadProperties {
		imageMaxSizeBytes = imageMaxSizeBytes > 0 ? imageMaxSizeBytes : DEFAULT_IMAGE_MAX_SIZE_BYTES;
		videoMaxSizeBytes = videoMaxSizeBytes > 0 ? videoMaxSizeBytes : DEFAULT_VIDEO_MAX_SIZE_BYTES;
		videoMaxDurationSeconds = videoMaxDurationSeconds > 0
			? videoMaxDurationSeconds
			: DEFAULT_VIDEO_MAX_DURATION_SECONDS;
		allowedImageTypes = normalizeTypes(allowedImageTypes, List.of("image/jpeg", "image/png", "image/webp"));
		allowedVideoTypes = normalizeTypes(allowedVideoTypes, List.of("video/mp4"));
		ffprobePath = ffprobePath == null || ffprobePath.isBlank() ? "ffprobe" : ffprobePath.trim();
	}

	public long maxSizeBytes(MediaType mediaType) {
		return mediaType == MediaType.VIDEO ? videoMaxSizeBytes : imageMaxSizeBytes;
	}

	public List<String> allowedTypes(MediaType mediaType) {
		return mediaType == MediaType.VIDEO ? allowedVideoTypes : allowedImageTypes;
	}

	public boolean allows(MediaType mediaType, String contentType) {
		return contentType != null && allowedTypes(mediaType).contains(normalizeType(contentType));
	}

	private static List<String> normalizeTypes(List<String> types, List<String> defaults) {
		List<String> source = types == null || types.isEmpty() ? defaults : types;
		return source.stream()
			.filter(type -> type != null && !type.isBlank())
			.map(MediaUploadProperties::normalizeType)
			.distinct()
			.toList();
	}

	private static String normalizeType(String contentType) {
		return contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
	}
}
