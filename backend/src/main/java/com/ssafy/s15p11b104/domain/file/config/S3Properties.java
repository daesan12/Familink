package com.ssafy.s15p11b104.domain.file.config;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.storage.s3")
public record S3Properties(
	String bucket,
	String region,
	String endpoint,
	Duration presignedUrlDuration,
	Duration downloadUrlDuration,
	List<String> allowedHosts) {

	public S3Properties {
		bucket = bucket == null || bucket.isBlank()
			? "s15p11b104-media-580779787807-ap-northeast-2-an"
			: bucket;
		region = region == null || region.isBlank() ? "ap-northeast-2" : region;
		presignedUrlDuration = presignedUrlDuration == null ? Duration.ofMinutes(10) : presignedUrlDuration;
		downloadUrlDuration = downloadUrlDuration == null ? Duration.ofMinutes(30) : downloadUrlDuration;
		allowedHosts = allowedHosts == null ? List.of() : List.copyOf(allowedHosts);
	}

	public boolean isAllowedHost(String host) {
		if (host == null || host.isBlank()) {
			return false;
		}
		if (allowedHosts.contains(host)) {
			return true;
		}
		if (endpoint != null && !endpoint.isBlank()) {
			try {
				String endpointHost = java.net.URI.create(endpoint).getHost();
				return host.equals(endpointHost);
			} catch (IllegalArgumentException ignored) {
				return false;
			}
		}
		return (bucket + ".s3." + region + ".amazonaws.com").equals(host);
	}

	public boolean isAllowedUri(java.net.URI uri) {
		if (uri == null || !isAllowedHost(uri.getHost())) {
			return false;
		}
		if (endpoint == null || endpoint.isBlank()) {
			return "https".equalsIgnoreCase(uri.getScheme());
		}
		try {
			java.net.URI endpointUri = java.net.URI.create(endpoint);
			if (uri.getHost().equals(endpointUri.getHost())) {
				return endpointUri.getScheme().equalsIgnoreCase(uri.getScheme())
					&& effectivePort(endpointUri) == effectivePort(uri);
			}
			return allowedHosts.contains(uri.getHost()) && "https".equalsIgnoreCase(uri.getScheme());
		} catch (IllegalArgumentException exception) {
			return false;
		}
	}

	private int effectivePort(java.net.URI uri) {
		if (uri.getPort() >= 0) {
			return uri.getPort();
		}
		return "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
	}
}
