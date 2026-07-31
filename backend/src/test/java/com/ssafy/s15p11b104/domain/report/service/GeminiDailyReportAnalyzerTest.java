package com.ssafy.s15p11b104.domain.report.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiClient;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiClientException;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiGenerationRequest;

class GeminiDailyReportAnalyzerTest {

	private static final String MODEL = "gemini-3.5-flash";

	private final ObjectMapper objectMapper = new ObjectMapper();

	@Test
	void analyzesAllCallSummariesAndGuardianMessagesInOrder() {
		RecordingGeminiClient client = new RecordingGeminiClient(response(
			"시장에서 가족과 일상 이야기를 나누며 편안함을 느낀 하루였습니다.",
			EmotionCategory.JOY,
			"따뜻함",
			"주말에 가족이 방문하면 좋겠습니다."
		));

		DailyReportAnalysis result = analyzer(client).analyze(input());

		assertThat(result.summary()).isEqualTo("시장에서 가족과 일상 이야기를 나누며 편안함을 느낀 하루였습니다.");
		assertThat(result.emotionCategory()).isEqualTo(EmotionCategory.JOY);
		assertThat(result.emotionSubcategory()).isEqualTo("따뜻함");
		assertThat(result.guardianMessage()).isEqualTo("주말에 가족이 방문하면 좋겠습니다.");
		assertThat(client.request.model()).isEqualTo(MODEL);
		assertThat(client.request.media()).isEmpty();
		assertThat(client.request.responseSchema()).isNotNull();
		assertThat(client.request.prompt())
			.contains("대표 감정은 guardianMessage가 아니라 모든 summary의 내용만으로 판단하세요.")
			.contains("summary: 오늘 시장에 다녀왔습니다.")
			.contains("guardianMessage: 주말에 방문해 주세요.")
			.contains("summary: 가족 이야기를 나눠 마음이 따뜻했습니다.")
			.contains("guardianMessage: null");
		assertThat(client.request.prompt().indexOf("오늘 시장에 다녀왔습니다."))
			.isLessThan(client.request.prompt().indexOf("가족 이야기를 나눠 마음이 따뜻했습니다."));
	}

	@ParameterizedTest
	@EnumSource(EmotionCategory.class)
	void acceptsEveryEmotionCategoryAndNullableGuardianMessage(EmotionCategory category) {
		RecordingGeminiClient client = new RecordingGeminiClient(response(
			"하루 동안 일상 이야기를 나눴습니다.",
			category,
			"차분함",
			null
		));

		DailyReportAnalysis result = analyzer(client).analyze(input());

		assertThat(result.emotionCategory()).isEqualTo(category);
		assertThat(result.guardianMessage()).isNull();
	}

	@Test
	void acceptsExactUnicodeLengthLimits() {
		RecordingGeminiClient client = new RecordingGeminiClient(response(
			"가".repeat(200),
			EmotionCategory.NEUTRAL,
			"나".repeat(50),
			"다".repeat(200)
		));

		DailyReportAnalysis result = analyzer(client).analyze(input());

		assertThat(result.summary().codePointCount(0, result.summary().length())).isEqualTo(200);
		assertThat(result.emotionSubcategory().codePointCount(0, result.emotionSubcategory().length())).isEqualTo(50);
		assertThat(result.guardianMessage().codePointCount(0, result.guardianMessage().length())).isEqualTo(200);
	}

	@ParameterizedTest
	@MethodSource("invalidResponses")
	void rejectsInvalidStructuredResponses(String response) {
		RecordingGeminiClient client = new RecordingGeminiClient(response);

		assertThatThrownBy(() -> analyzer(client).analyze(input()))
			.isInstanceOf(DailyReportAnalysisException.class)
			.hasMessage("일일 리포트 분석 응답이 유효하지 않습니다.");
	}

	@Test
	void rejectsInvalidInputWithoutCallingGemini() {
		RecordingGeminiClient client = new RecordingGeminiClient(null);

		assertThatThrownBy(() -> analyzer(client).analyze(new DailyReportInput(List.of())))
			.isInstanceOf(DailyReportAnalysisException.class)
			.hasMessage("일일 리포트 분석 입력이 유효하지 않습니다.");
		assertThat(client.request).isNull();
	}

	@Test
	void mapsGeminiFailureWithoutExposingUpstreamMessage() {
		RecordingGeminiClient client = new RecordingGeminiClient(null);
		client.failure = new GeminiClientException("upstream test-secret");

		assertThatThrownBy(() -> analyzer(client).analyze(input()))
			.isInstanceOf(DailyReportAnalysisException.class)
			.hasMessage("일일 리포트 분석 호출에 실패했습니다.")
			.hasMessageNotContaining("test-secret")
			.hasNoCause();
	}

	private static Stream<String> invalidResponses() {
		return Stream.of(
			"",
			"{",
			"""
				{"summary":"summary","emotionCategory":"JOY","emotionSubcategory":"happy",
				"guardianMessage":null} {}
				""",
			"{\"summary\":\"요약\"}",
			"""
				{"summary":"요약","emotionCategory":"JOY","emotionSubcategory":"기쁨",
				"guardianMessage":null,"extra":"허용 안 됨"}
				""",
			"""
				{"summary":"첫 요약","summary":"중복 요약","emotionCategory":"JOY",
				"emotionSubcategory":"기쁨","guardianMessage":null}
				""",
			"""
				{"summary":"요약","emotionCategory":" JOY ","emotionSubcategory":"기쁨",
				"guardianMessage":null}
				""",
			"""
				{"summary":"요약","emotionCategory":"UNKNOWN","emotionSubcategory":"기쁨",
				"guardianMessage":null}
				""",
			"""
				{"summary":"   ","emotionCategory":"JOY","emotionSubcategory":"기쁨",
				"guardianMessage":null}
				""",
			"""
				{"summary":"%s","emotionCategory":"JOY","emotionSubcategory":"기쁨",
				"guardianMessage":null}
				""".formatted("가".repeat(201)),
			"""
				{"summary":"요약","emotionCategory":"JOY","emotionSubcategory":"%s",
				"guardianMessage":null}
				""".formatted("가".repeat(51)),
			"""
				{"summary":"요약","emotionCategory":"JOY","emotionSubcategory":"기쁨",
				"guardianMessage":"   "}
				""",
			"""
				{"summary":"요약","emotionCategory":"JOY","emotionSubcategory":"기쁨",
				"guardianMessage":"%s"}
				""".formatted("가".repeat(201)),
			"""
				{"summary":"요약","emotionCategory":"JOY","emotionSubcategory":"기쁨",
				"guardianMessage":123}
				"""
		);
	}

	private GeminiDailyReportAnalyzer analyzer(RecordingGeminiClient client) {
		return new GeminiDailyReportAnalyzer(client, objectMapper, MODEL);
	}

	private DailyReportInput input() {
		return new DailyReportInput(List.of(
			new DailyReportInput.CallReportContext("오늘 시장에 다녀왔습니다.", "주말에 방문해 주세요."),
			new DailyReportInput.CallReportContext("가족 이야기를 나눠 마음이 따뜻했습니다.", null)
		));
	}

	private String response(
		String summary,
		EmotionCategory emotionCategory,
		String emotionSubcategory,
		String guardianMessage
	) {
		ObjectNode response = objectMapper.createObjectNode();
		response.put("summary", summary);
		response.put("emotionCategory", emotionCategory.name());
		response.put("emotionSubcategory", emotionSubcategory);
		if (guardianMessage == null) {
			response.putNull("guardianMessage");
		} else {
			response.put("guardianMessage", guardianMessage);
		}
		return response.toString();
	}

	private static class RecordingGeminiClient implements GeminiClient {

		private final String response;
		private GeminiGenerationRequest request;
		private RuntimeException failure;

		private RecordingGeminiClient(String response) {
			this.response = response;
		}

		@Override
		public String generate(GeminiGenerationRequest request) {
			this.request = request;
			if (failure != null) {
				throw failure;
			}
			return response;
		}
	}
}
