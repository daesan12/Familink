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
	private static final String TEXT_EXPECTED_SUMMARY =
		"아이들과 동네 공원에서 봄꽃을 구경하고 즐거운 시간을 보냈다.";
	private static final String PHOTO_EXPECTED_SUMMARY =
		"가족들이 어머니의 생일을 축하하며 케이크를 먹고 기념사진을 남겼다.";
	private static final String VIDEO_EXPECTED_SUMMARY =
		"아이들이 집 앞 산책로에서 처음으로 자전거를 타며 혼자 달리는 경험을 했다.";

	private final ObjectMapper objectMapper = new ObjectMapper();

	@Test
	void realisticFixturesUseExpectedSummaries() {
		assertThat(AnalysisTestFixtures.textPost().expectedSummary()).isEqualTo(TEXT_EXPECTED_SUMMARY);
		assertThat(AnalysisTestFixtures.photoPost().expectedSummary()).isEqualTo(PHOTO_EXPECTED_SUMMARY);
		assertThat(AnalysisTestFixtures.videoPost().expectedSummary()).isEqualTo(VIDEO_EXPECTED_SUMMARY);
	}

	@Test
	void routesTextOnlyPostToTextModel() {
		AnalysisTestFixtures.PostFixture fixture = AnalysisTestFixtures.textPost();
		RecordingGateway gateway = new RecordingGateway(responseWithSummary(
			"  " + TEXT_EXPECTED_SUMMARY + "  "));

		String summary = analyzer(gateway).analyze(fixture.toContentInput());

		assertThat(summary).isEqualTo(TEXT_EXPECTED_SUMMARY);
		assertThat(gateway.request.model()).isEqualTo(TEXT_MODEL);
		assertThat(gateway.request.media()).isEmpty();
		assertThat(gateway.request.prompt()).contains(fixture.content());
	}

	@Test
	void routesImagePostToMultimodalModelAndPreservesMediaOrder() {
		AnalysisTestFixtures.PostFixture fixture = AnalysisTestFixtures.photoPost();
		RecordingGateway gateway = new RecordingGateway(responseWithSummary(PHOTO_EXPECTED_SUMMARY));

		String summary = analyzer(gateway).analyze(fixture.toContentInput());

		assertThat(summary).isEqualTo(PHOTO_EXPECTED_SUMMARY);
		assertThat(gateway.request.model()).isEqualTo(MULTIMODAL_MODEL);
		assertThat(gateway.request.media()).containsExactlyElementsOf(
			fixture.media().stream().map(AnalysisTestFixtures.MediaFixture::toContentMedia).toList());
		assertThat(gateway.request.prompt()).contains(fixture.content());
		assertThat(gateway.request.prompt()).contains("키워드 목록", "메타데이터");
	}

	@Test
	void routesVideoPostToMultimodalModel() {
		AnalysisTestFixtures.PostFixture fixture = AnalysisTestFixtures.videoPost();
		RecordingGateway gateway = new RecordingGateway(responseWithSummary(VIDEO_EXPECTED_SUMMARY));

		String summary = analyzer(gateway).analyze(fixture.toContentInput());

		assertThat(summary).isEqualTo(VIDEO_EXPECTED_SUMMARY);
		assertThat(gateway.request.model()).isEqualTo(MULTIMODAL_MODEL);
		assertThat(gateway.request.media()).containsExactlyElementsOf(
			fixture.media().stream().map(AnalysisTestFixtures.MediaFixture::toContentMedia).toList());
	}

	@Test
	void rejectsImageCountOutsideAllowedRangeWithoutCallingGateway() {
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("사용되지 않음"));
		GeminiPostContentAnalyzer analyzer = analyzer(gateway);
		String content = AnalysisTestFixtures.photoPost().content();

		assertFailure(analyzer, new PostContentInput(content, MediaType.IMAGE, List.of()),
			AnalysisFailureType.INVALID_INPUT);
		assertFailure(analyzer, new PostContentInput(content, MediaType.IMAGE, List.of(
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
		String videoContent = AnalysisTestFixtures.videoPost().content();
		String photoContent = AnalysisTestFixtures.photoPost().content();

		assertFailure(analyzer, new PostContentInput(videoContent, MediaType.VIDEO, List.of(
			media(MediaType.VIDEO, "https://cdn.example.com/1.mp4", "video/mp4"),
			media(MediaType.VIDEO, "https://cdn.example.com/2.mp4", "video/mp4"))),
			AnalysisFailureType.INVALID_INPUT);
		assertFailure(analyzer, new PostContentInput(photoContent, MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, "https://cdn.example.com/image.jpg", "image/jpeg"),
			media(MediaType.VIDEO, "https://cdn.example.com/video.mp4", "video/mp4"))),
			AnalysisFailureType.INVALID_INPUT);

		assertThat(gateway.request).isNull();
	}

	@Test
	void rejectsUnsupportedUriAndMimeWithoutCallingGateway() {
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("사용되지 않음"));
		GeminiPostContentAnalyzer analyzer = analyzer(gateway);
		String content = AnalysisTestFixtures.photoPost().content();

		assertFailure(analyzer, new PostContentInput(content, MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, "http://cdn.example.com/image.jpg", "image/jpeg"))),
			AnalysisFailureType.INVALID_INPUT);
		assertFailure(analyzer, new PostContentInput(content, MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, "https://cdn.example.com/file.pdf", "application/pdf"))),
			AnalysisFailureType.INVALID_INPUT);
		assertFailure(analyzer, new PostContentInput(content, MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, "https://cdn.example.com/image.jpg", null))),
			AnalysisFailureType.INVALID_INPUT);
		assertFailure(analyzer, new PostContentInput(content, MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, "https://cdn.example.com/image.jpg", "   "))),
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
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("사용되지 않음"));

		assertFailure(analyzer(gateway), new PostContentInput(
			AnalysisTestFixtures.photoPost().content(), MediaType.IMAGE, List.of(
			media(MediaType.IMAGE, "https://cdn.example.com/audio.mp3", "audio/mpeg"))),
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
		RecordingGateway gateway = new RecordingGateway(responseWithSummary("사용되지 않음"));
		gateway.failure = new GeminiGatewayException("upstream failure test-secret");

		PostContentAnalysisException exception = org.assertj.core.api.Assertions.catchThrowableOfType(
			() -> analyzer(gateway).analyze(new PostContentInput(
				AnalysisTestFixtures.textPost().content(), null, List.of())),
			PostContentAnalysisException.class);

		assertThat(exception.getType()).isEqualTo(AnalysisFailureType.UPSTREAM_FAILURE);
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
