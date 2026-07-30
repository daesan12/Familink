package com.ssafy.s15p11b104.domain.call.report;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.call.entity.SpeakerType;
import com.ssafy.s15p11b104.domain.call.report.CallReportInput.TranscriptLine;
import com.ssafy.s15p11b104.global.ai.gemini.GoogleGeminiClient;

@Tag("manual-gms")
class GeminiCallReportE2eTest {

	private static final String DEFAULT_BASE_URL =
		"https://gms.ssafy.io/gmsapi/generativelanguage.googleapis.com";

	@Test
	void generatesCallReportFromRepresentativeTranscript() {
		String apiKey = requiredEnvironment("GMS_API_KEY");
		String baseUrl = environmentOrDefault("GMS_API_BASE_URL", DEFAULT_BASE_URL);
		String model = environmentOrDefault("GEMINI_CALL_REPORT_MODEL", "gemini-3.5-flash");
		GeminiCallReportAnalyzer analyzer = new GeminiCallReportAnalyzer(
			new GoogleGeminiClient(apiKey, baseUrl),
			new ObjectMapper(),
			model
		);
		CallReportInput input = new CallReportInput(List.of(
			new TranscriptLine(1, SpeakerType.USER, "오늘 시장에 가서 과일을 샀어."),
			new TranscriptLine(2, SpeakerType.ASSISTANT, "어떤 과일을 고르셨어요?"),
			new TranscriptLine(3, SpeakerType.USER, "딸이 좋아하는 사과를 샀지. 주말에 오면 같이 먹고 싶어.")
		));

		CallReportAnalysis result = analyzer.analyze(input);

		assertThat(result.summary()).isNotBlank();
		assertThat(result.summary().codePointCount(0, result.summary().length())).isLessThanOrEqualTo(100);
		assertThat(result.emotionCategory()).isNotNull();
		assertThat(result.emotionSubcategory()).isNotBlank();
		assertThat(result.emotionSubcategory().codePointCount(0, result.emotionSubcategory().length()))
			.isLessThanOrEqualTo(50);
		if (result.guardianMessage() != null) {
			assertThat(result.guardianMessage()).isNotBlank();
			assertThat(result.guardianMessage().codePointCount(0, result.guardianMessage().length()))
				.isLessThanOrEqualTo(100);
		}
	}

	private String requiredEnvironment(String name) {
		String value = System.getenv(name);
		assertThat(value).as(name + " must be provided for manual GMS E2E").isNotBlank();
		return value;
	}

	private String environmentOrDefault(String name, String defaultValue) {
		String value = System.getenv(name);
		return value == null || value.isBlank() ? defaultValue : value;
	}
}
