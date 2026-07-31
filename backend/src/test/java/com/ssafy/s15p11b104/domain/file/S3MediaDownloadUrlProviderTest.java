package com.ssafy.s15p11b104.domain.file;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.net.URI;
import java.net.MalformedURLException;
import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.ssafy.s15p11b104.domain.file.config.S3Properties;
import com.ssafy.s15p11b104.domain.file.service.S3MediaDownloadUrlProvider;

import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

class S3MediaDownloadUrlProviderTest {

	private static final String BUCKET = "s15p11b104-media-580779787807-ap-northeast-2-an";

	@Test
	void canonicalS3UrlIsConvertedToTemporaryGetUrl() {
		S3Presigner presigner = mock(S3Presigner.class);
		PresignedGetObjectRequest signedRequest = mock(PresignedGetObjectRequest.class);
		given(signedRequest.url()).willReturn(url("https://signed.example/download"));
		given(presigner.presignGetObject(any(GetObjectPresignRequest.class))).willReturn(signedRequest);

		S3MediaDownloadUrlProvider provider = new S3MediaDownloadUrlProvider(
			presigner,
			properties());

		String result = provider.issueDownloadUrl(
			"https://" + BUCKET + ".s3.ap-northeast-2.amazonaws.com/post-media/image.jpg");

		assertThat(result).isEqualTo("https://signed.example/download");
		ArgumentCaptor<GetObjectPresignRequest> requestCaptor =
			ArgumentCaptor.forClass(GetObjectPresignRequest.class);
		verify(presigner).presignGetObject(requestCaptor.capture());
		assertThat(requestCaptor.getValue().signatureDuration()).isEqualTo(Duration.ofMinutes(30));
		assertThat(requestCaptor.getValue().getObjectRequest().bucket()).isEqualTo(BUCKET);
		assertThat(requestCaptor.getValue().getObjectRequest().key()).isEqualTo("post-media/image.jpg");
	}

	@Test
	void nonCanonicalFixtureUrlIsReturnedWithoutAwsCall() {
		S3Presigner presigner = mock(S3Presigner.class);
		S3MediaDownloadUrlProvider provider = new S3MediaDownloadUrlProvider(
			presigner,
			new S3Properties(BUCKET, "ap-northeast-2", "", Duration.ofMinutes(10),
				Duration.ofMinutes(30), List.of("cdn")));

		String result = provider.issueDownloadUrl("https://cdn/image.jpg");

		assertThat(result).isEqualTo("https://cdn/image.jpg");
	}

	@Test
	void localEndpointPathIsRemovedBeforePresigning() {
		S3Presigner presigner = mock(S3Presigner.class);
		PresignedGetObjectRequest signedRequest = mock(PresignedGetObjectRequest.class);
		given(signedRequest.url()).willReturn(url("http://signed.example/download"));
		given(presigner.presignGetObject(any(GetObjectPresignRequest.class))).willReturn(signedRequest);
		S3MediaDownloadUrlProvider provider = new S3MediaDownloadUrlProvider(
			presigner,
			new S3Properties(BUCKET, "ap-northeast-2", "http://localhost:9000/storage",
				Duration.ofMinutes(10), Duration.ofMinutes(30), List.of()));

		String result = provider.issueDownloadUrl(
			"http://localhost:9000/storage/" + BUCKET + "/post-media/image.jpg");

		assertThat(result).isEqualTo("http://signed.example/download");
		ArgumentCaptor<GetObjectPresignRequest> requestCaptor =
			ArgumentCaptor.forClass(GetObjectPresignRequest.class);
		verify(presigner).presignGetObject(requestCaptor.capture());
		assertThat(requestCaptor.getValue().getObjectRequest().bucket()).isEqualTo(BUCKET);
		assertThat(requestCaptor.getValue().getObjectRequest().key()).isEqualTo("post-media/image.jpg");
	}

	@Test
	void localEndpointPathWithTrailingSlashIsNormalized() {
		S3Presigner presigner = mock(S3Presigner.class);
		PresignedGetObjectRequest signedRequest = mock(PresignedGetObjectRequest.class);
		given(signedRequest.url()).willReturn(url("http://signed.example/download"));
		given(presigner.presignGetObject(any(GetObjectPresignRequest.class))).willReturn(signedRequest);
		S3MediaDownloadUrlProvider provider = new S3MediaDownloadUrlProvider(
			presigner,
			new S3Properties(BUCKET, "ap-northeast-2", "http://localhost:9000/storage/",
				Duration.ofMinutes(10), Duration.ofMinutes(30), List.of()));

		String result = provider.issueDownloadUrl(
			"http://localhost:9000/storage/" + BUCKET + "/post-media/image.jpg");

		assertThat(result).isEqualTo("http://signed.example/download");
		ArgumentCaptor<GetObjectPresignRequest> requestCaptor =
			ArgumentCaptor.forClass(GetObjectPresignRequest.class);
		verify(presigner).presignGetObject(requestCaptor.capture());
		assertThat(requestCaptor.getValue().getObjectRequest().key()).isEqualTo("post-media/image.jpg");
	}

	private S3Properties properties() {
		return new S3Properties(BUCKET, "ap-northeast-2", "", Duration.ofMinutes(10),
			Duration.ofMinutes(30), List.of());
	}

	private java.net.URL url(String value) {
		try {
			return URI.create(value).toURL();
		} catch (MalformedURLException exception) {
			throw new IllegalArgumentException(exception);
		}
	}
}
