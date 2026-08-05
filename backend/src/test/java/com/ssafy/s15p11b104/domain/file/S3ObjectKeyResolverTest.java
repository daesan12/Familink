package com.ssafy.s15p11b104.domain.file;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.s15p11b104.domain.file.config.S3Properties;
import com.ssafy.s15p11b104.domain.file.service.S3ObjectKeyResolver;

class S3ObjectKeyResolverTest {

	private static final String BUCKET = "media-bucket";

	private final S3ObjectKeyResolver resolver = new S3ObjectKeyResolver(new S3Properties(
		BUCKET,
		"ap-northeast-2",
		null,
		Duration.ofMinutes(10),
		Duration.ofMinutes(30),
		List.of("cdn.example.com")));

	@Test
	void resolvesProfileImageKeysFromConfiguredS3AndCdnHosts() {
		assertThat(resolver.resolveProfileImage(
			"https://media-bucket.s3.ap-northeast-2.amazonaws.com/profile-image/s3.png"))
			.contains("profile-image/s3.png");
		assertThat(resolver.resolveProfileImage("https://cdn.example.com/profile-image/cdn.webp"))
			.contains("profile-image/cdn.webp");
	}

	@Test
	void rejectsInvalidProfileImageUrlsAndKeys() {
		assertThat(resolver.resolveProfileImage("https://example.com/profile-image/external.png")).isEmpty();
		assertThat(resolver.resolveProfileImage("https://cdn.example.com/post-media/post.png")).isEmpty();
		assertThat(resolver.resolveProfileImage("https://cdn.example.com/profile-image/")).isEmpty();
		assertThat(resolver.resolveProfileImage("not a url")).isEmpty();
	}

	@Test
	void keepsPostAndProfileImagePurposesSeparated() {
		assertThat(resolver.resolve("https://cdn.example.com/profile-image/profile.png")).isEmpty();
		assertThat(resolver.resolveProfileImage("https://cdn.example.com/posts/legacy.png")).isEmpty();
		assertThat(resolver.resolve("https://cdn.example.com/post-media/post.png"))
			.contains("post-media/post.png");
		assertThat(resolver.resolve("https://cdn.example.com/posts/legacy.png"))
			.contains("posts/legacy.png");
	}

	@Test
	void normalizeStripsPresignedQueryWhileKeepingHostAndPath() {
		assertThat(resolver.normalizePostMediaUrl(
			"https://media-bucket.s3.ap-northeast-2.amazonaws.com/post-media/photo.jpg"
				+ "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc"))
			.isEqualTo("https://media-bucket.s3.ap-northeast-2.amazonaws.com/post-media/photo.jpg");
		assertThat(resolver.normalizePostMediaUrl(
			"https://cdn.example.com/post-media/photo.jpg?token=abc"))
			.isEqualTo("https://cdn.example.com/post-media/photo.jpg");
	}

	@Test
	void normalizeKeepsUrlsWithoutQueryUnchanged() {
		assertThat(resolver.normalizePostMediaUrl(
			"https://media-bucket.s3.ap-northeast-2.amazonaws.com/post-media/photo.jpg"))
			.isEqualTo("https://media-bucket.s3.ap-northeast-2.amazonaws.com/post-media/photo.jpg");
	}

	@Test
	void normalizeReturnsOriginalWhenObjectKeyCannotBeResolved() {
		assertThat(resolver.normalizePostMediaUrl("https://example.com/post-media/photo.jpg?sig=abc"))
			.isEqualTo("https://example.com/post-media/photo.jpg?sig=abc");
		assertThat(resolver.normalizePostMediaUrl("https://cdn.example.com/other/photo.jpg?sig=abc"))
			.isEqualTo("https://cdn.example.com/other/photo.jpg?sig=abc");
		assertThat(resolver.normalizePostMediaUrl("not a url")).isEqualTo("not a url");
	}
}
