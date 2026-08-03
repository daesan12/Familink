package com.ssafy.s15p11b104.domain.feed.analysis;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.google.genai.Client;
import com.google.genai.types.DeleteFileConfig;
import com.google.genai.types.FileState;
import com.google.genai.types.HttpOptions;
import com.google.genai.types.UploadFileConfig;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiClientException;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiFailureType;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiGenerationRequest;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiMedia;
import com.ssafy.s15p11b104.global.ai.gemini.GoogleGeminiClient;

@Component
public class GoogleDirectGeminiMediaClient implements DirectGeminiMediaClient {

	private final boolean enabled;
	private final MediaTempFileDownloader downloader;
	private final GeminiSdk sdk;
	private final Duration readyTimeout;
	private final Duration pollInterval;

	@Autowired
	public GoogleDirectGeminiMediaClient(
		@Value("${gemini.analysis.direct-media-enabled:false}") boolean enabled,
		@Value("${gemini.analysis.direct-api-key:}") String apiKey,
		@Value("${gemini.analysis.direct-base-url:https://generativelanguage.googleapis.com}") String baseUrl,
		@Value("${gemini.request-timeout-ms:30000}") int requestTimeoutMillis,
		@Value("${gemini.analysis.media-ready-timeout:120s}") Duration readyTimeout,
		@Value("${gemini.analysis.media-poll-interval:1s}") Duration pollInterval,
		MediaTempFileDownloader downloader
	) {
		this(
			enabled,
			downloader,
			createSdk(enabled, apiKey, baseUrl, requestTimeoutMillis),
			readyTimeout,
			pollInterval
		);
		if (enabled && (apiKey == null || apiKey.isBlank())) {
			throw new IllegalStateException("GEMINI_API_KEY is required when direct media analysis is enabled");
		}
	}

	GoogleDirectGeminiMediaClient(
		boolean enabled,
		MediaTempFileDownloader downloader,
		GeminiSdk sdk,
		Duration readyTimeout,
		Duration pollInterval
	) {
		if (readyTimeout.isZero() || readyTimeout.isNegative()) {
			throw new IllegalArgumentException("Gemini media ready timeout must be positive");
		}
		if (pollInterval.isZero() || pollInterval.isNegative()) {
			throw new IllegalArgumentException("Gemini media poll interval must be positive");
		}
		this.enabled = enabled;
		this.downloader = downloader;
		this.sdk = sdk;
		this.readyTimeout = readyTimeout;
		this.pollInterval = pollInterval;
	}

	@Override
	public String generate(GeminiGenerationRequest request) {
		if (!enabled || sdk == null) {
			throw new GeminiClientException(
				"Direct Gemini media analysis is not configured",
				GeminiFailureType.CLIENT_ERROR,
				"DIRECT_GEMINI_NOT_CONFIGURED",
				false,
				null);
		}
		if (request.media().isEmpty()) {
			throw new IllegalArgumentException("Direct Gemini media request must contain media");
		}

		List<Path> temporaryFiles = new ArrayList<>();
		List<String> uploadedFileNames = new ArrayList<>();
		try {
			List<GeminiMedia> uploadedMedia = new ArrayList<>();
			for (int index = 0; index < request.media().size(); index++) {
				GeminiMedia media = request.media().get(index);
				Path temporaryFile = downloader.download(media.uri(), media.mimeType());
				temporaryFiles.add(temporaryFile);

				UploadedFile uploadedFile = sdk.upload(temporaryFile, media.mimeType());
				uploadedFileNames.add(uploadedFile.name());
				UploadedFile readyFile = waitUntilReady(uploadedFile);
				uploadedMedia.add(new GeminiMedia(readyFile.uri(), media.mimeType()));
			}

			return sdk.generate(new GeminiGenerationRequest(
				request.model(),
				request.prompt(),
				uploadedMedia,
				request.responseSchema()));
		} catch (GeminiClientException exception) {
			throw exception;
		} catch (IOException exception) {
			throw failure(GeminiFailureType.IO_ERROR, "MEDIA_DOWNLOAD_FAILED", false, exception);
		} catch (RuntimeException exception) {
			throw failure(GeminiFailureType.UNKNOWN, "DIRECT_GEMINI_FAILED", false, exception);
		} finally {
			uploadedFileNames.forEach(this::deleteUploadedFileQuietly);
			temporaryFiles.forEach(this::deleteTemporaryFileQuietly);
		}
	}

	private UploadedFile waitUntilReady(UploadedFile uploadedFile) {
		long deadline = System.nanoTime() + readyTimeout.toNanos();
		UploadedFile current = uploadedFile;
		while (System.nanoTime() < deadline) {
			if (current.state() == UploadState.ACTIVE) {
				return current;
			}
			if (current.state() == UploadState.FAILED) {
				throw failure(GeminiFailureType.CLIENT_ERROR, "GEMINI_FILE_PROCESSING_FAILED", false, null);
			}
			sleepBeforePolling();
			current = sdk.get(current.name());
		}
		throw failure(GeminiFailureType.TIMEOUT, "GEMINI_FILE_PROCESSING_TIMEOUT", true, null);
	}

	private void sleepBeforePolling() {
		try {
			Thread.sleep(pollInterval.toMillis());
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw failure(GeminiFailureType.INTERRUPTED, "INTERRUPTED", false, exception);
		}
	}

	private void deleteUploadedFileQuietly(String fileName) {
		try {
			sdk.delete(fileName);
		} catch (RuntimeException ignored) {
			// Cleanup failure must not replace the analysis result.
		}
	}

	private void deleteTemporaryFileQuietly(Path path) {
		try {
			Files.deleteIfExists(path);
		} catch (IOException ignored) {
			// Cleanup failure must not replace the analysis result.
		}
	}

	private GeminiClientException failure(
		GeminiFailureType failureType,
		String failureCode,
		boolean retryable,
		Throwable cause
	) {
		return new GeminiClientException(
			"Direct Gemini media analysis failed",
			failureType,
			failureCode,
			retryable,
			cause);
	}

	private static GeminiSdk createSdk(
		boolean enabled,
		String apiKey,
		String baseUrl,
		int requestTimeoutMillis
	) {
		if (!enabled || apiKey == null || apiKey.isBlank()) {
			return null;
		}
		Client client = Client.builder()
			.apiKey(apiKey)
			.httpOptions(HttpOptions.builder()
				.baseUrl(baseUrl)
				.apiVersion("v1beta")
				.headers(java.util.Map.of("x-goog-api-key", apiKey))
				.timeout(requestTimeoutMillis)
				.build())
			.build();
		GoogleGeminiClient generator = new GoogleGeminiClient(apiKey, baseUrl, requestTimeoutMillis);
		return new GoogleGeminiSdk(client, generator);
	}

	interface GeminiSdk {

		UploadedFile upload(Path path, String mimeType);

		UploadedFile get(String name);

		String generate(GeminiGenerationRequest request);

		void delete(String name);
	}

	record UploadedFile(String name, String uri, UploadState state) {
	}

	enum UploadState {
		PROCESSING,
		ACTIVE,
		FAILED
	}

	private static final class GoogleGeminiSdk implements GeminiSdk {

		private final Client client;
		private final GoogleGeminiClient generator;

		private GoogleGeminiSdk(Client client, GoogleGeminiClient generator) {
			this.client = client;
			this.generator = generator;
		}

		@Override
		public UploadedFile upload(Path path, String mimeType) {
			com.google.genai.types.File file = client.files.upload(
				path.toFile(),
				UploadFileConfig.builder().mimeType(mimeType).build());
			return toUploadedFile(file);
		}

		@Override
		public UploadedFile get(String name) {
			return toUploadedFile(client.files.get(name, null));
		}

		@Override
		public String generate(GeminiGenerationRequest request) {
			return generator.generate(request);
		}

		@Override
		public void delete(String name) {
			client.files.delete(name, DeleteFileConfig.builder().build());
		}

		private UploadedFile toUploadedFile(com.google.genai.types.File file) {
			String name = file.name().orElseThrow(() -> new IllegalStateException("Gemini file name is missing"));
			String uri = file.uri().orElse("");
			UploadState state = file.state()
				.map(FileState::knownEnum)
				.map(this::toUploadState)
				.orElse(UploadState.PROCESSING);
			if (state == UploadState.ACTIVE && uri.isBlank()) {
				throw new IllegalStateException("Gemini file URI is missing");
			}
			return new UploadedFile(name, uri, state);
		}

		private UploadState toUploadState(FileState.Known state) {
			return switch (state) {
				case ACTIVE -> UploadState.ACTIVE;
				case FAILED -> UploadState.FAILED;
				default -> UploadState.PROCESSING;
			};
		}
	}
}
