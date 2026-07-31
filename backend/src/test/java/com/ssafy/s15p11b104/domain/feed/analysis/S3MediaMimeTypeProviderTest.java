package com.ssafy.s15p11b104.domain.feed.analysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.s15p11b104.domain.file.config.S3Properties;

import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;

@ExtendWith(MockitoExtension.class)
class S3MediaMimeTypeProviderTest {

	private static final String BUCKET = "family-media";
	private static final String REGION = "ap-northeast-2";

	@Mock
	private S3Client s3Client;

	@Test
	void readsContentTypeFromDefaultS3Url() {
		when(s3Client.headObject(any(HeadObjectRequest.class)))
			.thenReturn(HeadObjectResponse.builder().contentType("image/jpeg").build());
		S3MediaMimeTypeProvider provider = provider(null, List.of());

		String mimeType = provider.getMimeType(
			"https://" + BUCKET + ".s3." + REGION + ".amazonaws.com/posts/family-photo.jpg");

		assertThat(mimeType).isEqualTo("image/jpeg");
		assertHeadObjectRequest("posts/family-photo.jpg");
	}

	@Test
	void stripsBucketPrefixFromConfiguredPathStyleEndpoint() {
		when(s3Client.headObject(any(HeadObjectRequest.class)))
			.thenReturn(HeadObjectResponse.builder().contentType("image/png").build());
		S3MediaMimeTypeProvider provider = provider("http://localhost:9000/storage", List.of());

		String mimeType = provider.getMimeType(
			"http://localhost:9000/storage/" + BUCKET + "/posts/family-table.png");

		assertThat(mimeType).isEqualTo("image/png");
		assertHeadObjectRequest("posts/family-table.png");
	}

	@Test
	void usesPathAsObjectKeyForAllowedCdnHost() {
		when(s3Client.headObject(any(HeadObjectRequest.class)))
			.thenReturn(HeadObjectResponse.builder().contentType("video/mp4").build());
		S3MediaMimeTypeProvider provider = provider(null, List.of("cdn.example.com"));

		String mimeType = provider.getMimeType("https://cdn.example.com/posts/first-bike-ride.mp4");

		assertThat(mimeType).isEqualTo("video/mp4");
		assertHeadObjectRequest("posts/first-bike-ride.mp4");
	}

	@Test
	void returnsNullWithoutS3CallForInvalidOrDisallowedUri() {
		S3MediaMimeTypeProvider provider = provider(null, List.of());

		assertThat(provider.getMimeType(null)).isNull();
		assertThat(provider.getMimeType(" ")).isNull();
		assertThat(provider.getMimeType("not a uri")).isNull();
		assertThat(provider.getMimeType("https://untrusted.example.com/posts/photo.jpg")).isNull();
		assertThat(provider.getMimeType(
			"https://" + BUCKET + ".s3." + REGION + ".amazonaws.com/")).isNull();
		verifyNoInteractions(s3Client);
	}

	@Test
	void returnsBlankContentTypeWithoutChangingIt() {
		when(s3Client.headObject(any(HeadObjectRequest.class)))
			.thenReturn(HeadObjectResponse.builder().contentType(" ").build());
		S3MediaMimeTypeProvider provider = provider(null, List.of());

		String mimeType = provider.getMimeType(
			"https://" + BUCKET + ".s3." + REGION + ".amazonaws.com/posts/photo.jpg");

		assertThat(mimeType).isEqualTo(" ");
	}

	@Test
	void propagatesS3Failure() {
		RuntimeException failure = S3Exception.builder().message("head object failed").statusCode(503).build();
		when(s3Client.headObject(any(HeadObjectRequest.class))).thenThrow(failure);
		S3MediaMimeTypeProvider provider = provider(null, List.of());

		assertThatThrownBy(() -> provider.getMimeType(
			"https://" + BUCKET + ".s3." + REGION + ".amazonaws.com/posts/photo.jpg"))
			.isSameAs(failure);
	}

	private S3MediaMimeTypeProvider provider(String endpoint, List<String> allowedHosts) {
		S3Properties properties = new S3Properties(
			BUCKET,
			REGION,
			endpoint,
			Duration.ofMinutes(10),
			Duration.ofMinutes(30),
			allowedHosts);
		return new S3MediaMimeTypeProvider(s3Client, properties);
	}

	private void assertHeadObjectRequest(String expectedKey) {
		ArgumentCaptor<HeadObjectRequest> request = ArgumentCaptor.forClass(HeadObjectRequest.class);
		verify(s3Client).headObject(request.capture());
		assertThat(request.getValue().bucket()).isEqualTo(BUCKET);
		assertThat(request.getValue().key()).isEqualTo(expectedKey);
	}
}
