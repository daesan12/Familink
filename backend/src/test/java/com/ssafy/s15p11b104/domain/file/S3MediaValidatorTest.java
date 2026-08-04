package com.ssafy.s15p11b104.domain.file;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.s15p11b104.domain.feed.entity.MediaType;
import com.ssafy.s15p11b104.domain.file.config.MediaUploadProperties;
import com.ssafy.s15p11b104.domain.file.config.S3Properties;
import com.ssafy.s15p11b104.domain.file.service.S3MediaValidator;
import com.ssafy.s15p11b104.domain.file.service.S3ObjectKeyResolver;
import com.ssafy.s15p11b104.domain.file.service.VideoDurationProvider;
import com.ssafy.s15p11b104.global.exception.BusinessException;

import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;

@ExtendWith(MockitoExtension.class)
class S3MediaValidatorTest {

	private static final String BUCKET = "media-bucket";

	@Mock
	private S3Client s3Client;

	@Mock
	private VideoDurationProvider videoDurationProvider;

	private S3MediaValidator validator;

	@BeforeEach
	void setUp() {
		S3Properties s3Properties = new S3Properties(
			BUCKET, "ap-northeast-2", null, Duration.ofMinutes(10), Duration.ofMinutes(30), List.of("cdn"));
		MediaUploadProperties mediaProperties = new MediaUploadProperties(
			10L * 1024 * 1024,
			100L * 1024 * 1024,
			60,
			List.of("image/jpeg", "image/png", "image/webp"),
			List.of("video/mp4"),
			"ffprobe");
		validator = new S3MediaValidator(
			s3Client,
			s3Properties,
			mediaProperties,
			new S3ObjectKeyResolver(s3Properties),
			videoDurationProvider);
	}

	@Test
	void acceptsExistingImageWithinLimit() {
		given(s3Client.headObject(any(HeadObjectRequest.class)))
			.willReturn(HeadObjectResponse.builder().contentLength(1024L).contentType("image/jpeg").build());

		assertThatCode(() -> validator.validate(MediaType.IMAGE, "https://cdn/post-media/photo.jpg"))
			.doesNotThrowAnyException();
	}

	@Test
	void acceptsExistingProfileImageWithinLimit() {
		given(s3Client.headObject(any(HeadObjectRequest.class)))
			.willReturn(HeadObjectResponse.builder().contentLength(1024L).contentType("image/webp").build());

		assertThatCode(() -> validator.validateProfileImage("https://cdn/profile-image/profile.webp"))
			.doesNotThrowAnyException();
		verify(s3Client).headObject(argThat((HeadObjectRequest request) ->
			BUCKET.equals(request.bucket()) && "profile-image/profile.webp".equals(request.key())));
	}

	@Test
	void rejectsProfileImageOutsideItsPurposeWithoutCallingS3() {
		assertThatThrownBy(() -> validator.validateProfileImage("https://cdn/post-media/post.jpg"))
			.isInstanceOf(BusinessException.class);

		verifyNoInteractions(s3Client);
	}

	@Test
	void rejectsProfileImageWithInvalidMetadata() {
		given(s3Client.headObject(any(HeadObjectRequest.class)))
			.willReturn(
				HeadObjectResponse.builder().contentLength(0L).contentType("image/jpeg").build(),
				HeadObjectResponse.builder().contentLength(10L * 1024 * 1024 + 1)
					.contentType("image/jpeg").build(),
				HeadObjectResponse.builder().contentLength(1024L).contentType("image/gif").build());

		for (int attempt = 0; attempt < 3; attempt++) {
			assertThatThrownBy(() -> validator.validateProfileImage("https://cdn/profile-image/invalid.jpg"))
				.isInstanceOfSatisfying(BusinessException.class, exception ->
					assertThat(exception.getField()).isEqualTo("profileImageUrl"));
		}
	}

	@Test
	void reportsThumbnailMetadataErrorsAgainstThumbnailUrl() {
		given(s3Client.headObject(any(HeadObjectRequest.class)))
			.willReturn(HeadObjectResponse.builder().contentLength(0L).contentType("image/jpeg").build());

		assertThatThrownBy(() -> validator.validateThumbnail("https://cdn/post-media/thumbnail.jpg"))
			.isInstanceOfSatisfying(BusinessException.class, exception ->
				assertThat(exception.getField()).isEqualTo("media.thumbnailUrl"));
	}

	@Test
	void rejectsActualObjectAboveLimit() {
		given(s3Client.headObject(any(HeadObjectRequest.class)))
			.willReturn(HeadObjectResponse.builder().contentLength(10L * 1024 * 1024 + 1)
				.contentType("image/jpeg").build());

		assertThatThrownBy(() -> validator.validate(MediaType.IMAGE, "https://cdn/post-media/photo.jpg"))
			.isInstanceOfSatisfying(BusinessException.class, exception -> {
				assertThat(exception.getField()).isEqualTo("media.fileUrl");
				assertThat(exception.getDetailMessage()).isEqualTo("사진은 파일당 10MB 이하만 올릴 수 있습니다.");
			});
	}

	@Test
	void acceptsVideoAtDurationLimit() {
		given(s3Client.headObject(any(HeadObjectRequest.class)))
			.willReturn(HeadObjectResponse.builder().contentLength(1024L).contentType("video/mp4").build());
		given(s3Client.getObject(any(software.amazon.awssdk.services.s3.model.GetObjectRequest.class)))
			.willReturn(new ResponseInputStream<>(GetObjectResponse.builder().build(), InputStream.nullInputStream()));
		given(videoDurationProvider.durationSeconds(any())).willReturn(BigDecimal.valueOf(60));

		assertThatCode(() -> validator.validate(MediaType.VIDEO, "https://cdn/post-media/video.mp4"))
			.doesNotThrowAnyException();
	}

	@Test
	void rejectsVideoAboveDurationLimit() {
		given(s3Client.headObject(any(HeadObjectRequest.class)))
			.willReturn(HeadObjectResponse.builder().contentLength(1024L).contentType("video/mp4").build());
		given(s3Client.getObject(any(software.amazon.awssdk.services.s3.model.GetObjectRequest.class)))
			.willReturn(new ResponseInputStream<>(GetObjectResponse.builder().build(), InputStream.nullInputStream()));
		given(videoDurationProvider.durationSeconds(any())).willReturn(BigDecimal.valueOf(60.01));

		assertThatThrownBy(() -> validator.validate(MediaType.VIDEO, "https://cdn/post-media/video.mp4"))
			.isInstanceOfSatisfying(BusinessException.class, exception -> {
				assertThat(exception.getField()).isEqualTo("media.fileUrl");
				assertThat(exception.getDetailMessage()).isEqualTo("영상은 최대 60초까지 올릴 수 있습니다.");
			});
	}

	@Test
	void rejectsMissingObjectAndUnsupportedType() {
		given(s3Client.headObject(any(HeadObjectRequest.class)))
			.willThrow(S3Exception.builder().statusCode(404).build());

		assertThatThrownBy(() -> validator.validate(MediaType.IMAGE, "https://cdn/post-media/missing.jpg"))
			.isInstanceOf(BusinessException.class);

		given(s3Client.headObject(any(HeadObjectRequest.class)))
			.willReturn(HeadObjectResponse.builder().contentLength(1024L).contentType("image/gif").build());
		assertThatThrownBy(() -> validator.validate(MediaType.IMAGE, "https://cdn/post-media/image.gif"))
			.isInstanceOf(BusinessException.class);
	}

	@Test
	void keepsValidatingExistingPostsPrefixObjects() {
		given(s3Client.headObject(any(HeadObjectRequest.class)))
			.willReturn(HeadObjectResponse.builder().contentLength(1024L).contentType("image/jpeg").build());

		assertThatCode(() -> validator.validate(MediaType.IMAGE, "https://cdn/posts/legacy.jpg"))
			.doesNotThrowAnyException();
		verify(s3Client).headObject(argThat((HeadObjectRequest request) -> "posts/legacy.jpg".equals(request.key())));
	}

	@Test
	void rejectsObjectsOutsidePostMediaPrefixes() {
		assertThatThrownBy(() -> validator.validate(MediaType.IMAGE, "https://cdn/avatars/profile.jpg"))
			.isInstanceOf(BusinessException.class);
	}
}
