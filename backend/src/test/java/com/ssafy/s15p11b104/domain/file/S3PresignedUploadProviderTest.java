package com.ssafy.s15p11b104.domain.file;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import com.ssafy.s15p11b104.domain.file.config.S3Properties;
import com.ssafy.s15p11b104.domain.file.dto.FileUploadRequest;
import com.ssafy.s15p11b104.domain.file.dto.UploadResponse;
import com.ssafy.s15p11b104.domain.file.service.S3PresignedUploadProvider;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

class S3PresignedUploadProviderTest {

	private final S3Presigner presigner = S3Presigner.builder()
		.region(Region.AP_NORTHEAST_2)
		.credentialsProvider(StaticCredentialsProvider.create(
			AwsBasicCredentials.create("test-access-key", "test-secret-key")))
		.build();

	private final S3PresignedUploadProvider provider = new S3PresignedUploadProvider(presigner, new S3Properties(
		"test-bucket",
		"ap-northeast-2",
		null,
		Duration.ofMinutes(10),
		null,
		List.of()));

	@AfterEach
	void closePresigner() {
		presigner.close();
	}

	@Test
	void signsContentTypeWithoutContentLength() {
		UploadResponse response = provider.issue("post-media",
			new FileUploadRequest("photo.jpg", "image/jpeg", 1024L));

		List<String> signedHeaders = signedHeaders(response.uploadUrl());
		assertThat(signedHeaders)
			.contains("content-type")
			.doesNotContain("content-length");
	}

	@Test
	void returnsOnlyContentTypeHeader() {
		UploadResponse response = provider.issue("post-media",
			new FileUploadRequest("photo.jpg", "image/jpeg", 1024L));

		assertThat(response.headers())
			.hasSize(1)
			.containsEntry("Content-Type", "image/jpeg");
	}

	@Test
	void keepsObjectKeyUnderPurposeNamespace() {
		UploadResponse response = provider.issue("post-media",
			new FileUploadRequest("photo.jpg", "image/jpeg", 1024L));

		assertThat(response.fileUrl()).matches(
			"https://test-bucket\\.s3\\.ap-northeast-2\\.amazonaws\\.com/post-media/[0-9a-f-]{36}\\.jpg");
	}

	private List<String> signedHeaders(String uploadUrl) {
		String query = URI.create(uploadUrl).getRawQuery();
		for (String parameter : query.split("&")) {
			String[] pair = parameter.split("=", 2);
			if ("X-Amz-SignedHeaders".equals(pair[0]) && pair.length == 2) {
				return List.of(URLDecoder.decode(pair[1], StandardCharsets.UTF_8).split(";"));
			}
		}
		return List.of();
	}
}
