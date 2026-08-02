package com.ssafy.s15p11b104.domain.file.service;

import java.net.URI;
import java.util.Optional;
import java.util.function.Predicate;

import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.domain.file.config.S3Properties;

@Component
public class S3ObjectKeyResolver {

	private static final String POST_MEDIA_PREFIX = "post-media/";
	private static final String LEGACY_POSTS_PREFIX = "posts/";
	private static final String PROFILE_IMAGE_PREFIX = "profile-image/";

	private final S3Properties properties;

	public S3ObjectKeyResolver(S3Properties properties) {
		this.properties = properties;
	}

	public Optional<String> resolve(String mediaUrl) {
		return resolve(mediaUrl, this::isPostMediaKey);
	}

	public Optional<String> resolveProfileImage(String mediaUrl) {
		return resolve(mediaUrl, this::isProfileImageKey);
	}

	private Optional<String> resolve(String mediaUrl, Predicate<String> allowedKey) {
		if (mediaUrl == null || mediaUrl.isBlank()) {
			return Optional.empty();
		}
		try {
			URI uri = URI.create(mediaUrl);
			if (!properties.isAllowedUri(uri)) {
				return Optional.empty();
			}
			String path = uri.getPath();
			if (path == null || path.isBlank() || "/".equals(path)) {
				return Optional.empty();
			}
			String key = path.startsWith("/") ? path.substring(1) : path;
			if (isConfiguredEndpoint(uri)) {
				String prefix = endpointPathPrefix() + properties.bucket() + "/";
				if (!key.startsWith(prefix)) {
					return Optional.empty();
				}
				key = key.substring(prefix.length());
			}
			return allowedKey.test(key) ? Optional.of(key) : Optional.empty();
		} catch (IllegalArgumentException exception) {
			return Optional.empty();
		}
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

	private boolean isPostMediaKey(String key) {
		return key.startsWith(POST_MEDIA_PREFIX) && key.length() > POST_MEDIA_PREFIX.length()
			|| key.startsWith(LEGACY_POSTS_PREFIX) && key.length() > LEGACY_POSTS_PREFIX.length();
	}

	private boolean isProfileImageKey(String key) {
		return key.startsWith(PROFILE_IMAGE_PREFIX) && key.length() > PROFILE_IMAGE_PREFIX.length();
	}
}
