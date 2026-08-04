package com.ssafy.s15p11b104.domain.file;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.s15p11b104.domain.file.config.S3Properties;
import com.ssafy.s15p11b104.domain.file.event.ProfileImageDeleteRequestedEvent;
import com.ssafy.s15p11b104.domain.file.service.ProfileImageDeleteListener;
import com.ssafy.s15p11b104.domain.file.service.S3ObjectKeyResolver;

import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

@ExtendWith(MockitoExtension.class)
class ProfileImageDeleteListenerTest {

	@Mock
	private S3Client s3Client;

	@Mock
	private S3Properties properties;

	@Mock
	private S3ObjectKeyResolver objectKeyResolver;

	private ProfileImageDeleteListener listener;

	@BeforeEach
	void setUp() {
		listener = new ProfileImageDeleteListener(s3Client, properties, objectKeyResolver);
	}

	@Test
	void deletesResolvedProfileImageObject() {
		when(properties.bucket()).thenReturn("bucket");
		when(objectKeyResolver.resolveProfileImage("https://cdn/profile-image/old.jpg"))
			.thenReturn(Optional.of("profile-image/old.jpg"));

		listener.deleteAfterCommit(new ProfileImageDeleteRequestedEvent("https://cdn/profile-image/old.jpg"));

		verify(s3Client).deleteObject(DeleteObjectRequest.builder()
			.bucket("bucket")
			.key("profile-image/old.jpg")
			.build());
	}

	@Test
	void refusesUnapprovedHostOrPrefix() {
		when(objectKeyResolver.resolveProfileImage("https://example.com/post-media/post.jpg"))
			.thenReturn(Optional.empty());

		listener.deleteAfterCommit(
			new ProfileImageDeleteRequestedEvent("https://example.com/post-media/post.jpg"));

		verify(s3Client, never()).deleteObject(any(DeleteObjectRequest.class));
	}

	@Test
	void s3FailureDoesNotEscapeAfterCommitListener() {
		when(properties.bucket()).thenReturn("bucket");
		when(objectKeyResolver.resolveProfileImage("https://cdn/profile-image/old.jpg"))
			.thenReturn(Optional.of("profile-image/old.jpg"));
		when(s3Client.deleteObject(any(DeleteObjectRequest.class)))
			.thenThrow(new RuntimeException("S3 unavailable"));

		assertThatCode(() -> listener.deleteAfterCommit(
			new ProfileImageDeleteRequestedEvent("https://cdn/profile-image/old.jpg")))
			.doesNotThrowAnyException();
	}
}
