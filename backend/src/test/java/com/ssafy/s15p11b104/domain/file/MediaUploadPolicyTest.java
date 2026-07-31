package com.ssafy.s15p11b104.domain.file;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.s15p11b104.domain.file.config.MediaUploadProperties;
import com.ssafy.s15p11b104.domain.file.dto.FileUploadRequest;
import com.ssafy.s15p11b104.domain.file.service.MediaUploadPolicy;
import com.ssafy.s15p11b104.global.exception.BusinessException;

class MediaUploadPolicyTest {

	private static final long IMAGE_LIMIT = 10L * 1024 * 1024;
	private static final long VIDEO_LIMIT = 100L * 1024 * 1024;

	private final MediaUploadPolicy policy = new MediaUploadPolicy(new MediaUploadProperties(
		IMAGE_LIMIT,
		VIDEO_LIMIT,
		60,
		List.of("image/jpeg", "image/png", "image/webp"),
		List.of("video/mp4"),
		"ffprobe"));

	@Test
	void acceptsAllowedImageAtTheLimit() {
		assertThatCode(() -> policy.validatePresignedRequest("post-media",
			new FileUploadRequest("photo.jpg", "image/jpeg", IMAGE_LIMIT))).doesNotThrowAnyException();
	}

	@Test
	void rejectsImageAboveTheLimit() {
		assertThatThrownBy(() -> policy.validatePresignedRequest("post-media",
			new FileUploadRequest("photo.jpg", "image/jpeg", IMAGE_LIMIT + 1)))
			.isInstanceOf(BusinessException.class);
	}

	@Test
	void rejectsUnsupportedType() {
		assertThatThrownBy(() -> policy.validatePresignedRequest("post-media",
			new FileUploadRequest("movie.webm", "video/webm", 1024L)))
			.isInstanceOf(BusinessException.class);
	}

	@Test
	void keepsNonPostMediaPurposeCompatible() {
		assertThatCode(() -> policy.validatePresignedRequest("avatar",
			new FileUploadRequest("document.pdf", "application/pdf", 1024L))).doesNotThrowAnyException();
	}
}
