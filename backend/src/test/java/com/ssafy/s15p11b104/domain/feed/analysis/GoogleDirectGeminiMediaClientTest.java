package com.ssafy.s15p11b104.domain.feed.analysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.google.genai.types.Schema;
import com.google.genai.types.Type;
import com.ssafy.s15p11b104.domain.feed.analysis.GoogleDirectGeminiMediaClient.GeminiSdk;
import com.ssafy.s15p11b104.domain.feed.analysis.GoogleDirectGeminiMediaClient.UploadState;
import com.ssafy.s15p11b104.domain.feed.analysis.GoogleDirectGeminiMediaClient.UploadedFile;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiClientException;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiGenerationRequest;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiMedia;

class GoogleDirectGeminiMediaClientTest {

	private static final Schema RESPONSE_SCHEMA = Schema.builder().type(Type.Known.OBJECT).build();

	@Test
	void uploadsDownloadedMediaAndCleansBothTemporaryCopiesAfterSuccess() throws Exception {
		Path localFile = Files.createTempFile("direct-gemini-success-", ".jpg");
		RecordingSdk sdk = new RecordingSdk();
		GoogleDirectGeminiMediaClient client = client(localFile, sdk, Duration.ofSeconds(1));

		String response = client.generate(request());

		assertThat(response).isEqualTo("{\"summary\":\"ok\"}");
		assertThat(sdk.generatedRequest.media())
			.containsExactly(new GeminiMedia("https://generativelanguage.googleapis.com/files/ready", "image/jpeg"));
		assertThat(sdk.deletedNames).containsExactly("files/uploaded");
		assertThat(localFile).doesNotExist();
	}

	@Test
	void cleansUploadedAndLocalFilesWhenGenerationFails() throws Exception {
		Path localFile = Files.createTempFile("direct-gemini-failure-", ".jpg");
		RecordingSdk sdk = new RecordingSdk();
		sdk.generationFailure = new GeminiClientException("upstream failed");
		GoogleDirectGeminiMediaClient client = client(localFile, sdk, Duration.ofSeconds(1));

		assertThatThrownBy(() -> client.generate(request()))
			.isInstanceOf(GeminiClientException.class);
		assertThat(sdk.deletedNames).containsExactly("files/uploaded");
		assertThat(localFile).doesNotExist();
	}

	@Test
	void timesOutAndCleansFilesWhenGeminiFileNeverBecomesActive() throws Exception {
		Path localFile = Files.createTempFile("direct-gemini-timeout-", ".mp4");
		RecordingSdk sdk = new RecordingSdk();
		sdk.keepProcessing = true;
		GoogleDirectGeminiMediaClient client = client(localFile, sdk, Duration.ofMillis(10));

		assertThatThrownBy(() -> client.generate(request()))
			.isInstanceOfSatisfying(GeminiClientException.class, exception -> {
				assertThat(exception.getFailureCode()).isEqualTo("GEMINI_FILE_PROCESSING_TIMEOUT");
				assertThat(exception.isRetryable()).isTrue();
			});
		assertThat(sdk.deletedNames).containsExactly("files/uploaded");
		assertThat(localFile).doesNotExist();
	}

	@Test
	void rejectsMediaRequestWhenDirectGeminiIsDisabled() throws Exception {
		Path localFile = Files.createTempFile("direct-gemini-disabled-", ".jpg");
		try {
			GoogleDirectGeminiMediaClient client = new GoogleDirectGeminiMediaClient(
				false,
				(mediaUri, mimeType) -> localFile,
				new RecordingSdk(),
				Duration.ofSeconds(1),
				Duration.ofMillis(1));

			assertThatThrownBy(() -> client.generate(request()))
				.isInstanceOfSatisfying(GeminiClientException.class, exception ->
					assertThat(exception.getFailureCode()).isEqualTo("DIRECT_GEMINI_NOT_CONFIGURED"));
		} finally {
			Files.deleteIfExists(localFile);
		}
	}

	@Test
	void rejectsStartupWhenDirectMediaIsEnabledWithoutApiKey() {
		assertThatThrownBy(() -> new GoogleDirectGeminiMediaClient(
			true,
			"",
			"https://generativelanguage.googleapis.com",
			30_000,
			Duration.ofSeconds(120),
			Duration.ofSeconds(1),
			(mediaUri, mimeType) -> null))
			.isInstanceOf(IllegalStateException.class)
			.hasMessageContaining("GEMINI_API_KEY");
	}

	private GoogleDirectGeminiMediaClient client(
		Path localFile,
		RecordingSdk sdk,
		Duration readyTimeout
	) {
		return new GoogleDirectGeminiMediaClient(
			true,
			(mediaUri, mimeType) -> localFile,
			sdk,
			readyTimeout,
			Duration.ofMillis(1));
	}

	private GeminiGenerationRequest request() {
		return new GeminiGenerationRequest(
			"gemini-model",
			"prompt",
			List.of(new GeminiMedia("https://bucket/photo.jpg", "image/jpeg")),
			RESPONSE_SCHEMA);
	}

	private static final class RecordingSdk implements GeminiSdk {

		private final List<String> deletedNames = new ArrayList<>();
		private GeminiGenerationRequest generatedRequest;
		private RuntimeException generationFailure;
		private boolean keepProcessing;

		@Override
		public UploadedFile upload(Path path, String mimeType) {
			return new UploadedFile("files/uploaded", "", UploadState.PROCESSING);
		}

		@Override
		public UploadedFile get(String name) {
			if (keepProcessing) {
				return new UploadedFile(name, "", UploadState.PROCESSING);
			}
			return new UploadedFile(
				name,
				"https://generativelanguage.googleapis.com/files/ready",
				UploadState.ACTIVE);
		}

		@Override
		public String generate(GeminiGenerationRequest request) {
			generatedRequest = request;
			if (generationFailure != null) {
				throw generationFailure;
			}
			return "{\"summary\":\"ok\"}";
		}

		@Override
		public void delete(String name) {
			deletedNames.add(name);
		}
	}
}
