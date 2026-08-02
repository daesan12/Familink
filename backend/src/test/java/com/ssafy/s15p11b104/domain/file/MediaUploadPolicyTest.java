package com.ssafy.s15p11b104.domain.file;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Collections;
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
	void acceptsFourImagesAtTheLimit() {
		List<FileUploadRequest> files = Collections.nCopies(4,
			new FileUploadRequest("photo.jpg", "image/jpeg", IMAGE_LIMIT));

		assertThatCode(() -> policy.validate("post-media", files)).doesNotThrowAnyException();
	}

	@Test
	void rejectsFiveImages() {
		List<FileUploadRequest> files = Collections.nCopies(5,
			new FileUploadRequest("photo.jpg", "image/jpeg", 1024L));

		assertThatThrownBy(() -> policy.validate("post-media", files))
			.isInstanceOf(BusinessException.class);
	}

	@Test
	void rejectsImageAboveTheLimit() {
		assertThatThrownBy(() -> policy.validate("post-media",
			List.of(new FileUploadRequest("photo.jpg", "image/jpeg", IMAGE_LIMIT + 1))))
			.isInstanceOf(BusinessException.class);
	}

	@Test
	void acceptsSingleVideoAtTheLimit() {
		assertThatCode(() -> policy.validate("post-media",
			List.of(new FileUploadRequest("movie.mp4", "video/mp4", VIDEO_LIMIT)))).doesNotThrowAnyException();
	}

	@Test
	void rejectsTwoVideos() {
		List<FileUploadRequest> files = Collections.nCopies(2,
			new FileUploadRequest("movie.mp4", "video/mp4", 1024L));

		assertThatThrownBy(() -> policy.validate("post-media", files))
			.isInstanceOf(BusinessException.class);
	}

	@Test
	void rejectsMixedImageAndVideo() {
		assertThatThrownBy(() -> policy.validate("post-media", List.of(
			new FileUploadRequest("photo.jpg", "image/jpeg", 1024L),
			new FileUploadRequest("movie.mp4", "video/mp4", 1024L))))
			.isInstanceOf(BusinessException.class);
	}

	@Test
	void rejectsUnsupportedType() {
		assertThatThrownBy(() -> policy.validate("post-media",
			List.of(new FileUploadRequest("movie.webm", "video/webm", 1024L))))
			.isInstanceOf(BusinessException.class);
	}

	@Test
	void normalizesContentTypeForSigning() {
		List<FileUploadRequest> normalized = policy.validate("post-media",
			List.of(new FileUploadRequest("photo.jpg", "IMAGE/JPEG; charset=utf-8", 1024L)));

		assertThat(normalized).singleElement()
			.extracting(FileUploadRequest::contentType)
			.isEqualTo("image/jpeg");
	}

	@Test
	void acceptsSingleProfileImage() {
		assertThatCode(() -> policy.validate("profile-image",
			List.of(new FileUploadRequest("me.png", "image/png", IMAGE_LIMIT)))).doesNotThrowAnyException();
	}

	@Test
	void rejectsProfileVideo() {
		assertThatThrownBy(() -> policy.validate("profile-image",
			List.of(new FileUploadRequest("movie.mp4", "video/mp4", 1024L))))
			.isInstanceOf(BusinessException.class);
	}

	@Test
	void rejectsTwoProfileImages() {
		List<FileUploadRequest> files = Collections.nCopies(2,
			new FileUploadRequest("me.png", "image/png", 1024L));

		assertThatThrownBy(() -> policy.validate("profile-image", files))
			.isInstanceOf(BusinessException.class);
	}

	@Test
	void rejectsEmptyFiles() {
		assertThatThrownBy(() -> policy.validate("post-media", List.of()))
			.isInstanceOf(BusinessException.class);
	}

	@Test
	void rejectsUnknownPurpose() {
		assertThatThrownBy(() -> policy.validate("avatar",
			List.of(new FileUploadRequest("document.pdf", "application/pdf", 1024L))))
			.isInstanceOf(BusinessException.class);
		assertThatThrownBy(() -> policy.validate("avatar",
			List.of(new FileUploadRequest("photo.jpg", "image/jpeg", 1024L))))
			.isInstanceOf(BusinessException.class);
	}

	@Test
	void rejectsPurposeCaseVariant() {
		assertThatThrownBy(() -> policy.validate("POST-MEDIA",
			List.of(new FileUploadRequest("photo.jpg", "image/jpeg", 1024L))))
			.isInstanceOf(BusinessException.class);
	}
}
