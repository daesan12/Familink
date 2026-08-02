package com.ssafy.s15p11b104.domain.feed.analysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.ssafy.s15p11b104.domain.feed.entity.MediaType;

class GeminiPostContentAnalyzerTest {

	private static final String TEXT_MODEL = "gemini-2.5-flash-lite";
	private static final String MULTIMODAL_MODEL = "gemini-3.5-flash";

	private final ObjectMapper objectMapper = new ObjectMapper();

	@Test
	void routesTextOnlyPostToTextModel() {
		AnalysisTestFixtures.PostFixture fixture = AnalysisTestFixtures.textPost();
		RecordingGateway gateway = new RecordingGateway(responseWithSummary(
			"  " + fixture.expectedSummary() + "  "));

		String summary = analyzer(gateway).analyze(fixture.toContentInput());

		assertThat(summary).isEqualTo(fixture.expectedSummary());
		assertThat(gateway.request.model()).isEqualTo(TEXT_MODEL);
		assertThat(gateway.request.media()).isEmpty();
		assertThat(gateway.request.prompt())
			.contains("나중에 가족과 대화할 때 소재로 활용할 수 있도록")
			.contains("누가 무엇을 했는지와 기억할 만한 경험")
			.contains("1~2문장")
			.contains("최대 500자")
			.contains(fixture.content());
	}

	@Test
	void routesImagePostToMultimodalModelAndPreservesMediaOrder() {
		AnalysisTestFixtures.PostFixture fixture = AnalysisTestFixtures.photoPost();
		RecordingGateway gateway = new RecordingGateway(responseWithSummary(fixture.expectedSummary()));

		String summary = analyzer(gateway).analyze(fixture.toContentInput());

		assertThat(summary).isEqualTo(fixture.expectedSummary());
		assertThat(gateway.request.model()).isEqualTo(MULTIMODAL_MODEL);
		assertThat(gateway.request.media()).containsExactlyElementsOf(
			fixture.media().stream().map(AnalysisTestFixtures.MediaFixture::toContentMedia).toList());
		assertThat(gateway.request.prompt()).contains(fixture.content());
		assertThat(gateway.request.prompt()).contains("가족과 대화할 때 소재", "1~2문장");
	}

	@Test
	void routesVideoPostToMultimodalModel() {
		AnalysisTestFixtures.PostFixture fixture = AnalysisTestFixtures.videoPost();
		RecordingGateway gateway = new RecordingGateway(responseWithSummary(fixture.expectedSummary()));

		String summary = analyzer(gateway).analyze(fixture.toContentInput());

		assertThat(summary).isEqualTo(fixture.expectedSummary());
		assertThat(gateway.request.model()).isEqualTo(MULTIMODAL_MODEL);
		assertThat(gateway.request.media()).containsExactlyElementsOf(
			fixture.media().stream().map(AnalysisTestFixtures.MediaFixture::toContentMedia).toList());
	}

	@Test
	void rejectsImageCountOutsideAllowedRangeWithoutCallingGateway() {
		RecordingGateway gateway = new RecordingGateway(null);
		GeminiPostContentAnalyzer analyzer = analyzer(gateway);
		String content = AnalysisTestFixtures.photoPost().content();

		assertFailure(analyzer, new PostContentInput(content, MediaType.IMAGE, List.of()),
			AnalysisFailureType.INVALID_INPUT);
		assertFailure(analyzer, new PostContentInput(content, MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, mediaUri("https", "jpg"), "image/jpeg"),
			media(MediaType.IMAGE, mediaUri("https", "jpg"), "image/jpeg"),
			media(MediaType.IMAGE, mediaUri("https", "jpg"), "image/jpeg"),
			media(MediaType.IMAGE, mediaUri("https", "jpg"), "image/jpeg"),
			media(MediaType.IMAGE, mediaUri("https", "jpg"), "image/jpeg"))),
			AnalysisFailureType.INVALID_INPUT);

		assertThat(gateway.request).isNull();
	}

	@Test
	void rejectsVideoCountAndMixedMediaWithoutCallingGateway() {
		RecordingGateway gateway = new RecordingGateway(null);
		GeminiPostContentAnalyzer analyzer = analyzer(gateway);
		String videoContent = AnalysisTestFixtures.videoPost().content();
		String photoContent = AnalysisTestFixtures.photoPost().content();

		assertFailure(analyzer, new PostContentInput(videoContent, MediaType.VIDEO, List.of(
			media(MediaType.VIDEO, mediaUri("https", "mp4"), "video/mp4"),
			media(MediaType.VIDEO, mediaUri("https", "mp4"), "video/mp4"))),
			AnalysisFailureType.INVALID_INPUT);
		assertFailure(analyzer, new PostContentInput(photoContent, MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, mediaUri("https", "jpg"), "image/jpeg"),
			media(MediaType.VIDEO, mediaUri("https", "mp4"), "video/mp4"))),
			AnalysisFailureType.INVALID_INPUT);

		assertThat(gateway.request).isNull();
	}

	@Test
	void rejectsUnsupportedUriAndMimeWithoutCallingGateway() {
		RecordingGateway gateway = new RecordingGateway(null);
		GeminiPostContentAnalyzer analyzer = analyzer(gateway);
		String content = AnalysisTestFixtures.photoPost().content();

		assertFailure(analyzer, new PostContentInput(content, MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, mediaUri("http", "jpg"), "image/jpeg"))),
			AnalysisFailureType.INVALID_INPUT);
		assertFailure(analyzer, new PostContentInput(content, MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, mediaUri("https", "pdf"), "application/pdf"))),
			AnalysisFailureType.INVALID_INPUT);
		assertFailure(analyzer, new PostContentInput(content, MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, mediaUri("https", "jpg"), null))),
			AnalysisFailureType.INVALID_INPUT);
		assertFailure(analyzer, new PostContentInput(content, MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, mediaUri("https", "jpg"), "   "))),
			AnalysisFailureType.INVALID_INPUT);

		assertThat(gateway.request).isNull();
	}

	@Test
	void acceptsExactly500UnicodeCodePoints() {
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("가".repeat(500)));

		String summary = analyzer(gateway).analyze(new PostContentInput(
			AnalysisTestFixtures.textPost().content(), null, List.of()));

		assertThat(summary.codePointCount(0, summary.length())).isEqualTo(500);
	}

	@Test
	void rejectsUnsupportedAudioMime() {
		RecordingGateway gateway = new RecordingGateway(null);

		assertFailure(analyzer(gateway), new PostContentInput(
			AnalysisTestFixtures.photoPost().content(), MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, mediaUri("https", "mp3"), "audio/mpeg"))),
			AnalysisFailureType.INVALID_INPUT);
		assertThat(gateway.request).isNull();
	}

	@Test
	void rejects501UnicodeCodePoints() {
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("가".repeat(501)));

		assertFailure(analyzer(gateway), new PostContentInput(
			AnalysisTestFixtures.textPost().content(), null, List.of()),
			AnalysisFailureType.INVALID_RESPONSE);
	}

	@Test
	void rejectsEmptyMalformedAndMissingSummaryResponses() {
		assertFailureForResponse("", AnalysisFailureType.INVALID_RESPONSE);
		assertFailureForResponse("{", AnalysisFailureType.INVALID_RESPONSE);
		assertFailureForResponse("{}", AnalysisFailureType.INVALID_RESPONSE);
		assertFailureForResponse("{\"summary\":null}", AnalysisFailureType.INVALID_RESPONSE);
		assertFailureForResponse("{\"summary\":\"   \"}", AnalysisFailureType.INVALID_RESPONSE);
	}

	@Test
	void mapsGatewayFailureWithoutExposingGatewayMessage() {
		RecordingGateway gateway = new RecordingGateway(null);
		gateway.failure = new GeminiGatewayException("upstream failure test-secret", "HTTP_429", true);

		PostContentAnalysisException exception = org.assertj.core.api.Assertions.catchThrowableOfType(
			() -> analyzer(gateway).analyze(new PostContentInput(
				AnalysisTestFixtures.textPost().content(), null, List.of())),
			PostContentAnalysisException.class);

		assertThat(exception.getType()).isEqualTo(AnalysisFailureType.UPSTREAM_FAILURE);
		assertThat(exception.getFailureCode()).isEqualTo("HTTP_429");
		assertThat(exception.isRetryable()).isTrue();
		assertThat(exception).hasMessageNotContaining("test-secret");
		assertThat(exception.getCause()).isNull();
	}

	@Test
	void missingApiKeyFailsWithoutExposingConfigurationDetails() {
		GeminiRequest request = new GeminiRequest(TEXT_MODEL, AnalysisTestFixtures.textPost().content(), List.of());

		assertThatThrownBy(() -> new GoogleGeminiGateway("", "https://gms.ssafy.io/gmsapi/generativelanguage.googleapis.com")
			.generate(request))
			.isInstanceOf(GeminiGatewayException.class)
			.hasMessage("Gemini API 키가 설정되지 않았습니다.")
			.hasMessageNotContaining("GMS_API_KEY");
	}

	private void assertFailureForResponse(String response, AnalysisFailureType expectedType) {
		RecordingGateway gateway = new RecordingGateway(response);
		assertFailure(analyzer(gateway), new PostContentInput(
			AnalysisTestFixtures.textPost().content(), null, List.of()), expectedType);
	}

	private void assertFailure(
		GeminiPostContentAnalyzer analyzer,
		PostContentInput input,
		AnalysisFailureType expectedType) {
		assertThatThrownBy(() -> analyzer.analyze(input))
			.isInstanceOfSatisfying(PostContentAnalysisException.class, exception ->
				assertThat(exception.getType()).isEqualTo(expectedType));
	}

	private GeminiPostContentAnalyzer analyzer(RecordingGateway gateway) {
		return new GeminiPostContentAnalyzer(gateway, objectMapper, TEXT_MODEL, MULTIMODAL_MODEL);
	}

	private PostContentMedia media(MediaType mediaType, String uri, String mimeType) {
		return new PostContentMedia(mediaType, uri, mimeType);
	}

	private String mediaUri(String scheme, String extension) {
		return AnalysisTestFixtures.mediaUri(scheme, extension);
	}

	private String responseWithSummary(String summary) {
		ObjectNode response = objectMapper.createObjectNode();
		response.put("summary", summary);
		return response.toString();
	}

	private static class RecordingGateway implements GeminiGateway {

		private final String response;
		private GeminiRequest request;
		private RuntimeException failure;

		private RecordingGateway(String response) {
			this.response = response;
		}

		@Override
		public String generate(GeminiRequest request) {
			this.request = request;
			if (failure != null) {
				throw failure;
			}
			return response;
		}
	}
}
