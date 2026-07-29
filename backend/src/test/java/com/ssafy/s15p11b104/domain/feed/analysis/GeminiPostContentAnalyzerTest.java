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
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("텍스트 요약"));

		String summary = analyzer(gateway).analyze(new PostContentInput("텍스트 게시글", null, List.of()));

		assertThat(summary).isEqualTo("텍스트 요약");
		assertThat(gateway.request.model()).isEqualTo(TEXT_MODEL);
		assertThat(gateway.request.media()).isEmpty();
	}

	@Test
	void routesImagePostToMultimodalModelAndPreservesMediaOrder() {
		PostContentMedia first = media(MediaType.IMAGE, "https://cdn.example.com/first.jpg", "image/jpeg");
		PostContentMedia second = media(MediaType.IMAGE, "https://cdn.example.com/second.webp", "image/webp");
		PostContentMedia third = media(MediaType.IMAGE, "https://cdn.example.com/third.png", "image/png");
		PostContentMedia fourth = media(MediaType.IMAGE, "https://cdn.example.com/fourth.jpg", "image/jpeg");
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("사진 요약"));

		analyzer(gateway).analyze(new PostContentInput(
			"사진 게시글",
			MediaType.IMAGE,
			List.of(first, second, third, fourth)));

		assertThat(gateway.request.model()).isEqualTo(MULTIMODAL_MODEL);
		assertThat(gateway.request.media()).containsExactly(first, second, third, fourth);
		assertThat(gateway.request.prompt()).contains("사진 게시글");
		assertThat(gateway.request.prompt()).contains("키워드 목록", "메타데이터");
	}

	@Test
	void routesVideoPostToMultimodalModel() {
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("영상 요약"));

		analyzer(gateway).analyze(new PostContentInput(
			"영상 게시글",
			MediaType.VIDEO,
			List.of(media(MediaType.VIDEO, "https://cdn.example.com/video.mp4", "video/mp4"))));

		assertThat(gateway.request.model()).isEqualTo(MULTIMODAL_MODEL);
	}

	@Test
	void rejectsImageCountOutsideAllowedRangeWithoutCallingGateway() {
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("사용되지 않음"));
		GeminiPostContentAnalyzer analyzer = analyzer(gateway);

		assertFailure(analyzer, new PostContentInput("본문", MediaType.IMAGE, List.of()),
			AnalysisFailureType.INVALID_INPUT);
		assertFailure(analyzer, new PostContentInput("본문", MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, "https://cdn.example.com/1.jpg", "image/jpeg"),
			media(MediaType.IMAGE, "https://cdn.example.com/2.jpg", "image/jpeg"),
			media(MediaType.IMAGE, "https://cdn.example.com/3.jpg", "image/jpeg"),
			media(MediaType.IMAGE, "https://cdn.example.com/4.jpg", "image/jpeg"),
			media(MediaType.IMAGE, "https://cdn.example.com/5.jpg", "image/jpeg"))),
			AnalysisFailureType.INVALID_INPUT);

		assertThat(gateway.request).isNull();
	}

	@Test
	void rejectsVideoCountAndMixedMediaWithoutCallingGateway() {
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("사용되지 않음"));
		GeminiPostContentAnalyzer analyzer = analyzer(gateway);

		assertFailure(analyzer, new PostContentInput("본문", MediaType.VIDEO, List.of(
			media(MediaType.VIDEO, "https://cdn.example.com/1.mp4", "video/mp4"),
			media(MediaType.VIDEO, "https://cdn.example.com/2.mp4", "video/mp4"))),
			AnalysisFailureType.INVALID_INPUT);
		assertFailure(analyzer, new PostContentInput("본문", MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, "https://cdn.example.com/image.jpg", "image/jpeg"),
			media(MediaType.VIDEO, "https://cdn.example.com/video.mp4", "video/mp4"))),
			AnalysisFailureType.INVALID_INPUT);

		assertThat(gateway.request).isNull();
	}

	@Test
	void rejectsUnsupportedUriAndMimeWithoutCallingGateway() {
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("사용되지 않음"));
		GeminiPostContentAnalyzer analyzer = analyzer(gateway);

		assertFailure(analyzer, new PostContentInput("본문", MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, "http://cdn.example.com/image.jpg", "image/jpeg"))),
			AnalysisFailureType.INVALID_INPUT);
		assertFailure(analyzer, new PostContentInput("본문", MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, "https://cdn.example.com/file.pdf", "application/pdf"))),
			AnalysisFailureType.INVALID_INPUT);
		assertFailure(analyzer, new PostContentInput("본문", MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, "https://cdn.example.com/image.jpg", null))),
			AnalysisFailureType.INVALID_INPUT);

		assertThat(gateway.request).isNull();
	}

	@Test
	void acceptsExactly500UnicodeCodePoints() {
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("가".repeat(500)));

		String summary = analyzer(gateway).analyze(new PostContentInput("본문", null, List.of()));

		assertThat(summary.codePointCount(0, summary.length())).isEqualTo(500);
	}

	@Test
	void rejectsUnsupportedAudioMime() {
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("사용되지 않음"));

		assertFailure(analyzer(gateway), new PostContentInput("본문", MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, "https://cdn.example.com/audio.mp3", "audio/mpeg"))),
			AnalysisFailureType.INVALID_INPUT);
		assertThat(gateway.request).isNull();
	}

	@Test
	void rejects501UnicodeCodePoints() {
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("가".repeat(501)));

		assertFailure(analyzer(gateway), new PostContentInput("본문", null, List.of()),
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
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("사용되지 않음"));
		gateway.failure = new GeminiGatewayException("upstream failure test-secret");

		PostContentAnalysisException exception = org.assertj.core.api.Assertions.catchThrowableOfType(
			() -> analyzer(gateway).analyze(new PostContentInput("본문", null, List.of())),
			PostContentAnalysisException.class);

		assertThat(exception.getType()).isEqualTo(AnalysisFailureType.UPSTREAM_FAILURE);
		assertThat(exception).hasMessageNotContaining("test-secret");
		assertThat(exception.getCause()).isNull();
	}

	@Test
	void missingApiKeyFailsWithoutExposingConfigurationDetails() {
		GeminiRequest request = new GeminiRequest(TEXT_MODEL, "본문 요약", List.of());

		assertThatThrownBy(() -> new GoogleGeminiGateway("").generate(request))
			.isInstanceOf(GeminiGatewayException.class)
			.hasMessage("Gemini API 키가 설정되지 않았습니다.")
			.hasMessageNotContaining("GMS_API_KEY");
	}

	private void assertFailureForResponse(String response, AnalysisFailureType expectedType) {
		RecordingGateway gateway = new RecordingGateway(response);
		assertFailure(analyzer(gateway), new PostContentInput("본문", null, List.of()), expectedType);
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
