package com.ssafy.s15p11b104.global.ai.gemini;

import java.io.InterruptedIOException;
import java.net.SocketTimeoutException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.google.genai.Client;
import com.google.genai.errors.ApiException;
import com.google.genai.errors.GenAiIOException;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.HttpOptions;
import com.google.genai.types.HttpRetryOptions;
import com.google.genai.types.Part;

@Component
public class GoogleGeminiClient implements GeminiClient {

	static final int DEFAULT_TIMEOUT_MILLIS = 30_000;

	private final GeminiSdkCaller sdkCaller;

	@Autowired
	public GoogleGeminiClient(
		@Value("${gemini.analysis.api-key:}") String apiKey,
		@Value("${gemini.analysis.base-url:"
			+ "https://gms.ssafy.io/gmsapi/generativelanguage.googleapis.com}") String baseUrl,
		@Value("${gemini.request-timeout-ms:30000}") int timeoutMillis
	) {
		this(createSdkCaller(apiKey, baseUrl, timeoutMillis));
	}

	public GoogleGeminiClient(String apiKey, String baseUrl) {
		this(apiKey, baseUrl, DEFAULT_TIMEOUT_MILLIS);
	}

	GoogleGeminiClient(GeminiSdkCaller sdkCaller) {
		this.sdkCaller = sdkCaller;
	}

	@Override
	public String generate(GeminiGenerationRequest request) {
		if (sdkCaller == null) {
			throw new GeminiClientException("Gemini API 키가 설정되지 않았습니다.");
		}

		try {
			return sdkCaller.generate(request);
		} catch (ApiException exception) {
			throw fromApiException(exception);
		} catch (GenAiIOException exception) {
			throw fromIoException(exception);
		} catch (RuntimeException exception) {
			throw new GeminiClientException(
				"Gemini 호출에 실패했습니다.",
				GeminiFailureType.UNKNOWN,
				"UNKNOWN",
				false,
				exception);
		}
	}

	static HttpOptions buildHttpOptions(String apiKey, String baseUrl, int timeoutMillis) {
		if (timeoutMillis <= 0) {
			throw new IllegalArgumentException("Gemini timeout must be positive");
		}
		return HttpOptions.builder()
			.baseUrl(baseUrl)
			.apiVersion("v1beta")
			.headers(Map.of("x-goog-api-key", apiKey))
			.timeout(timeoutMillis)
			.retryOptions(HttpRetryOptions.builder().attempts(1).build())
			.build();
	}

	private static GeminiSdkCaller createSdkCaller(String apiKey, String baseUrl, int timeoutMillis) {
		if (apiKey == null || apiKey.isBlank()) {
			return null;
		}

		Client client = Client.builder()
			.apiKey(apiKey)
			.httpOptions(buildHttpOptions(apiKey, baseUrl, timeoutMillis))
			.build();
		return request -> {
			GenerateContentConfig config = GenerateContentConfig.builder()
				.responseMimeType("application/json")
				.responseSchema(request.responseSchema())
				.candidateCount(1)
				.build();
			Content content = toContent(request);
			GenerateContentResponse response = client.models.generateContent(request.model(), content, config);
			return response.text();
		};
	}

	private static Content toContent(GeminiGenerationRequest request) {
		List<Part> parts = new ArrayList<>();
		parts.add(Part.fromText(request.prompt()));
		request.media().forEach(media -> parts.add(Part.fromUri(media.uri(), media.mimeType())));
		return Content.fromParts(parts.toArray(new Part[0]));
	}

	private GeminiClientException fromApiException(ApiException exception) {
		int statusCode = exception.code();
		if (statusCode == 408) {
			return failure(GeminiFailureType.TIMEOUT, "HTTP_408", true, exception);
		}
		if (statusCode == 429) {
			return failure(GeminiFailureType.RATE_LIMITED, "HTTP_429", true, exception);
		}
		if (statusCode >= 500 && statusCode <= 599) {
			return failure(GeminiFailureType.SERVER_ERROR, "HTTP_5XX", true, exception);
		}
		return failure(GeminiFailureType.CLIENT_ERROR, "HTTP_4XX", false, exception);
	}

	private GeminiClientException fromIoException(GenAiIOException exception) {
		Throwable cause = exception;
		while (cause != null) {
			if (cause instanceof SocketTimeoutException) {
				return failure(GeminiFailureType.TIMEOUT, "TIMEOUT", true, exception);
			}
			if (cause instanceof InterruptedIOException interruptedIOException) {
				if (isTimeout(interruptedIOException)) {
					return failure(GeminiFailureType.TIMEOUT, "TIMEOUT", true, exception);
				}
				Thread.currentThread().interrupt();
				return failure(GeminiFailureType.INTERRUPTED, "INTERRUPTED", false, exception);
			}
			cause = cause.getCause();
		}
		return failure(GeminiFailureType.IO_ERROR, "IO_ERROR", false, exception);
	}

	private boolean isTimeout(InterruptedIOException exception) {
		String message = exception.getMessage();
		return message != null
			&& (message.equalsIgnoreCase("timeout")
				|| message.toLowerCase(Locale.ROOT).contains("timed out"));
	}

	private GeminiClientException failure(
		GeminiFailureType type,
		String code,
		boolean retryable,
		RuntimeException cause
	) {
		return new GeminiClientException("Gemini 호출에 실패했습니다.", type, code, retryable, cause);
	}
}
