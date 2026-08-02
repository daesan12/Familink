package com.ssafy.s15p11b104.global.ai.gemini;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.InterruptedIOException;
import java.net.SocketTimeoutException;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.google.genai.errors.ApiException;
import com.google.genai.errors.GenAiIOException;
import com.google.genai.types.HttpOptions;
import com.google.genai.types.Schema;
import com.google.genai.types.Type;

class GoogleGeminiClientTest {

	private static final GeminiGenerationRequest REQUEST = new GeminiGenerationRequest(
		"test-model",
		"test prompt",
		List.of(),
		Schema.builder().type(Type.Known.OBJECT).build());

	@Test
	void configuresThirtySecondTotalTimeoutAndDisablesSdkRetry() {
		HttpOptions options = GoogleGeminiClient.buildHttpOptions(
			"api-key", "https://example.com", GoogleGeminiClient.DEFAULT_TIMEOUT_MILLIS);

		assertThat(options.timeout()).contains(30_000);
		assertThat(options.retryOptions()).isPresent();
		assertThat(options.retryOptions().orElseThrow().attempts()).contains(1);
	}

	@Test
	void mapsRetryableHttpFailures() {
		assertFailure(new ApiException(429, "rate", "rate"), "HTTP_429", true);
		assertFailure(new ApiException(503, "server", "server"), "HTTP_5XX", true);
		assertFailure(new ApiException(408, "timeout", "timeout"), "HTTP_408", true);
	}

	@Test
	void mapsClientErrorAsPermanentFailure() {
		assertFailure(new ApiException(400, "bad request", "bad request"), "HTTP_4XX", false);
	}

	@Test
	void mapsSocketTimeoutAsRetryable() {
		assertFailure(new GenAiIOException("timeout", new SocketTimeoutException("slow")), "TIMEOUT", true);
	}

	@Test
	void mapsOkHttpCallTimeoutAsRetryable() {
		assertFailure(new GenAiIOException("timeout", new InterruptedIOException("timeout")), "TIMEOUT", true);
	}

	@Test
	void mapsGenericInterruptedIoAsPermanentAndRestoresInterrupt() {
		try {
			assertFailure(
				new GenAiIOException("interrupted", new InterruptedIOException("cancelled")),
				"INTERRUPTED",
				false);
			assertThat(Thread.currentThread().isInterrupted()).isTrue();
		} finally {
			Thread.interrupted();
		}
	}

	private void assertFailure(RuntimeException failure, String expectedCode, boolean retryable) {
		GoogleGeminiClient client = new GoogleGeminiClient(request -> {
			throw failure;
		});

		assertThatThrownBy(() -> client.generate(REQUEST))
			.isInstanceOfSatisfying(GeminiClientException.class, exception -> {
				assertThat(exception.getFailureCode()).isEqualTo(expectedCode);
				assertThat(exception.isRetryable()).isEqualTo(retryable);
				assertThat(exception).hasMessage("Gemini 호출에 실패했습니다.");
			});
	}
}
