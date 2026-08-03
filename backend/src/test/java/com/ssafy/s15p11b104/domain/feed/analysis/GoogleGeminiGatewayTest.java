package com.ssafy.s15p11b104.domain.feed.analysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;

import com.ssafy.s15p11b104.global.ai.gemini.GeminiClientException;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiFailureType;
import com.ssafy.s15p11b104.domain.feed.entity.MediaType;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

class GoogleGeminiGatewayTest {

	@Test
	void routesTextToGmsAndMediaToDirectGeminiWithoutFallback() {
		AtomicInteger gmsCalls = new AtomicInteger();
		AtomicInteger directCalls = new AtomicInteger();
		GoogleGeminiGateway gateway = new GoogleGeminiGateway(
			request -> {
				gmsCalls.incrementAndGet();
				return "{\"summary\":\"text\"}";
			},
			request -> {
				directCalls.incrementAndGet();
				return "{\"summary\":\"media\"}";
			});

		String textResponse = gateway.generate(new GeminiRequest("text-model", "text", List.of()));
		String mediaResponse = gateway.generate(new GeminiRequest(
			"media-model",
			"media",
			List.of(new PostContentMedia(MediaType.IMAGE, "https://bucket/photo.jpg", "image/jpeg"))));

		assertThat(textResponse).isEqualTo("{\"summary\":\"text\"}");
		assertThat(mediaResponse).isEqualTo("{\"summary\":\"media\"}");
		assertThat(gmsCalls).hasValue(1);
		assertThat(directCalls).hasValue(1);
	}

	@Test
	void preservesRetryMetadataWithoutExposingUpstreamDetails() {
		GoogleGeminiGateway gateway = new GoogleGeminiGateway(request -> {
			throw new GeminiClientException(
				"safe message",
				GeminiFailureType.RATE_LIMITED,
				"HTTP_429",
				true,
				new IllegalStateException("test-secret"));
		});

		assertThatThrownBy(() -> gateway.generate(new GeminiRequest("model", "prompt", List.of())))
			.isInstanceOfSatisfying(GeminiGatewayException.class, exception -> {
				assertThat(exception.getFailureCode()).isEqualTo("HTTP_429");
				assertThat(exception.isRetryable()).isTrue();
				assertThat(exception).hasMessageNotContaining("test-secret");
			});
	}

	@Test
	void sendsGmsProxyPathAndHeaderToConfiguredBaseUrl() throws IOException {
		AnalysisTestFixtures.PostFixture fixture = AnalysisTestFixtures.textPost();
		AtomicReference<URI> requestUri = new AtomicReference<>();
		AtomicReference<String> apiKeyHeader = new AtomicReference<>();
		AtomicReference<String> requestBody = new AtomicReference<>();
		HttpServer server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
		server.createContext("/", exchange -> handleRequest(
			exchange, requestUri, apiKeyHeader, requestBody, fixture.expectedSummary()));
		server.start();

		try {
			String baseUrl = "http://localhost:" + server.getAddress().getPort()
				+ "/gmsapi/generativelanguage.googleapis.com";
			String response = new GoogleGeminiGateway("test-gms-key", baseUrl).generate(
				new GeminiRequest("gemini-2.5-flash-lite", fixture.content(), List.of()));

			assertThat(response).isEqualTo("{\"summary\":\"" + fixture.expectedSummary() + "\"}");
			assertThat(requestUri.get().getPath()).isEqualTo(
				"/gmsapi/generativelanguage.googleapis.com/v1beta/models/"
					+ "gemini-2.5-flash-lite:generateContent");
			assertThat(apiKeyHeader).hasValue("test-gms-key");
			assertThat(requestBody).hasValueSatisfying(body -> assertThat(body)
				.contains("\"responseMimeType\":\"application/json\"", "\"summary\"", fixture.content()));
		} finally {
			server.stop(0);
		}
	}

	@Test
	void serializesMultimodalUrisAndMimeTypesIntoGatewayPayload() throws IOException {
		AnalysisTestFixtures.PostFixture fixture = AnalysisTestFixtures.photoPost();
		AtomicReference<String> requestBody = new AtomicReference<>();
		HttpServer server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
		server.createContext("/", exchange -> handleRequest(
			exchange,
			new AtomicReference<>(),
			new AtomicReference<>(),
			requestBody,
			fixture.expectedSummary()));
		server.start();

		try {
			String baseUrl = "http://localhost:" + server.getAddress().getPort()
				+ "/gmsapi/generativelanguage.googleapis.com";
			new GoogleGeminiGateway("test-gms-key", baseUrl).generate(new GeminiRequest(
				"gemini-3.5-flash",
				fixture.content(),
				fixture.media().stream().map(AnalysisTestFixtures.MediaFixture::toContentMedia).toList()));

			assertThat(requestBody).hasValueSatisfying(body -> {
				assertThat(body).contains(fixture.content(), "fileData");
				fixture.media().forEach(media -> assertThat(body)
					.contains(media.uri(), media.mimeType()));
			});
		} finally {
			server.stop(0);
		}
	}

	private void handleRequest(
		HttpExchange exchange,
		AtomicReference<URI> requestUri,
		AtomicReference<String> apiKeyHeader,
		AtomicReference<String> requestBody,
		String expectedSummary) throws IOException {
		requestUri.set(exchange.getRequestURI());
		apiKeyHeader.set(exchange.getRequestHeaders().getFirst("x-goog-api-key"));
		requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
		byte[] response = ("{\"candidates\":[{\"content\":{"
			+ "\"parts\":[{\"text\":\"{\\\"summary\\\":\\\""
			+ expectedSummary.replace("\"", "\\\"")
			+ "\\\"}\"}]}}]}")
			.getBytes(StandardCharsets.UTF_8);
		exchange.getResponseHeaders().set("Content-Type", "application/json");
		exchange.sendResponseHeaders(200, response.length);
		exchange.getResponseBody().write(response);
		exchange.close();
	}
}
