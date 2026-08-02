package com.ssafy.s15p11b104.domain.file.dto;

import java.time.Instant;
import java.util.Map;

public record UploadResponse(
	String uploadUrl,
	String fileUrl,
	Map<String, String> headers,
	Instant expiresAt) {
}
