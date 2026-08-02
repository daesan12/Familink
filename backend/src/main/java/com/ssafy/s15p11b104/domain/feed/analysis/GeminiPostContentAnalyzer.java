package com.ssafy.s15p11b104.domain.feed.analysis;

import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.feed.entity.MediaType;

@Service
public class GeminiPostContentAnalyzer implements PostContentAnalyzer {

	private static final int MAX_SUMMARY_CODE_POINTS = 500;
	private static final int MAX_IMAGES = 4;

	private final GeminiGateway geminiGateway;
	private final ObjectMapper objectMapper;
	private final String textModel;
	private final String multimodalModel;

	public GeminiPostContentAnalyzer(
		GeminiGateway geminiGateway,
		ObjectMapper objectMapper,
		@Value("${gemini.analysis.text-model:gemini-2.5-flash-lite}") String textModel,
		@Value("${gemini.analysis.multimodal-model:gemini-3.5-flash}") String multimodalModel) {
		this.geminiGateway = geminiGateway;
		this.objectMapper = objectMapper;
		this.textModel = textModel;
		this.multimodalModel = multimodalModel;
	}

	@Override
	public String analyze(PostContentInput input) {
		validateInput(input);

		String model = input.media().isEmpty() ? textModel : multimodalModel;
		GeminiRequest request = new GeminiRequest(model, buildPrompt(input.content()), input.media());
		String rawResponse;
		try {
			rawResponse = geminiGateway.generate(request);
		} catch (GeminiGatewayException exception) {
			throw new PostContentAnalysisException(
				AnalysisFailureType.UPSTREAM_FAILURE,
				"Gemini 분석 호출에 실패했습니다.",
				exception.getFailureCode(),
				exception.isRetryable());
		} catch (RuntimeException exception) {
			throw new PostContentAnalysisException(
				AnalysisFailureType.UPSTREAM_FAILURE,
				"Gemini 분석 호출에 실패했습니다.",
				"UPSTREAM_FAILURE",
				false);
		}

		return parseSummary(rawResponse);
	}

	private void validateInput(PostContentInput input) {
		if (input == null || input.content() == null || input.content().isBlank()) {
			throw invalidInput();
		}

		List<PostContentMedia> media = input.media();
		if (media == null || media.isEmpty()) {
			if (input.mediaType() != null) {
				throw invalidInput();
			}
			return;
		}

		if (input.mediaType() == null
			|| media.stream().anyMatch(item -> item == null || item.mediaType() != input.mediaType())) {
			throw invalidInput();
		}

		Set<MediaType> mediaTypes = new HashSet<>();
		for (PostContentMedia item : media) {
			mediaTypes.add(item.mediaType());
			validateMedia(item);
		}

		if (mediaTypes.size() != 1) {
			throw invalidInput();
		}

		MediaType mediaType = mediaTypes.iterator().next();
		if (mediaType == MediaType.IMAGE && (media.size() < 1 || media.size() > MAX_IMAGES)) {
			throw invalidInput();
		}
		if (mediaType == MediaType.VIDEO && media.size() != 1) {
			throw invalidInput();
		}
	}

	private void validateMedia(PostContentMedia media) {
		if (media.uri() == null || media.uri().isBlank()) {
			throw invalidInput();
		}

		try {
			URI uri = URI.create(media.uri());
			if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
				throw invalidInput();
			}
		} catch (IllegalArgumentException exception) {
			throw invalidInput();
		}

		String mimeType = media.mimeType() == null ? "" : media.mimeType().trim().toLowerCase(Locale.ROOT);
		if (mimeType.isBlank()) {
			throw invalidInput();
		}
		if (media.mediaType() == MediaType.IMAGE && !mimeType.startsWith("image/")) {
			throw invalidInput();
		}
		if (media.mediaType() == MediaType.VIDEO && !mimeType.startsWith("video/")) {
			throw invalidInput();
		}
	}

	private String buildPrompt(String content) {
		return """
				게시글 본문과 첨부 미디어를 바탕으로, 나중에 가족과 대화할 때 소재로 활용할 수 있도록
				핵심 내용을 자연스러운 한국어로 요약하세요.
				누가 무엇을 했는지와 기억할 만한 경험을 중심으로 1~2문장으로 작성하세요.
				본문과 미디어에서 확인되지 않은 내용은 추가하지 마세요.
				요약은 최대 500자를 넘지 않아야 합니다.
				응답은 반드시 JSON 객체 하나만 반환하고, 다른 필드는 포함하지 마세요.
				JSON 형식: {\"summary\": \"최대 500자의 요약\"}

				게시글 본문:
				%s
				""".formatted(content);
	}

	private String parseSummary(String rawResponse) {
		if (rawResponse == null || rawResponse.isBlank()) {
			throw invalidResponse();
		}

		try {
			JsonNode root = objectMapper.readTree(rawResponse);
			if (root == null || !root.isObject() || root.size() != 1) {
				throw invalidResponse();
			}

			JsonNode summaryNode = root.get("summary");
			if (summaryNode == null || !summaryNode.isTextual()) {
				throw invalidResponse();
			}

			String summary = summaryNode.asText().trim();
			int codePointCount = summary.codePointCount(0, summary.length());
			if (summary.isEmpty() || codePointCount > MAX_SUMMARY_CODE_POINTS) {
				throw invalidResponse();
			}
			return summary;
		} catch (JsonProcessingException exception) {
			throw invalidResponse();
		}
	}

	private PostContentAnalysisException invalidInput() {
		return new PostContentAnalysisException(
			AnalysisFailureType.INVALID_INPUT,
			"게시글 분석 입력이 유효하지 않습니다.");
	}

	private PostContentAnalysisException invalidResponse() {
		return new PostContentAnalysisException(
			AnalysisFailureType.INVALID_RESPONSE,
			"Gemini 분석 응답이 유효하지 않습니다.");
	}
}
