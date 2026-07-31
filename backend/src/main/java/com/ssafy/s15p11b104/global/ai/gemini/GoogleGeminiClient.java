package com.ssafy.s15p11b104.global.ai.gemini;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.HttpOptions;
import com.google.genai.types.Part;

@Component
public class GoogleGeminiClient implements GeminiClient {

	private final Client client;

	public GoogleGeminiClient(
		@Value("${gemini.analysis.api-key:}") String apiKey,
		@Value("${gemini.analysis.base-url:"
			+ "https://gms.ssafy.io/gmsapi/generativelanguage.googleapis.com}") String baseUrl
	) {
		client = apiKey == null || apiKey.isBlank()
			? null
			: Client.builder()
				.apiKey(apiKey)
				.httpOptions(HttpOptions.builder()
					.baseUrl(baseUrl)
					.apiVersion("v1beta")
					.headers(Map.of("x-goog-api-key", apiKey))
					.build())
				.build();
	}

	@Override
	public String generate(GeminiGenerationRequest request) {
		if (client == null) {
			throw new GeminiClientException("Gemini API 키가 설정되지 않았습니다.");
		}

		try {
			GenerateContentConfig config = GenerateContentConfig.builder()
				.responseMimeType("application/json")
				.responseSchema(request.responseSchema())
				.candidateCount(1)
				.build();
			Content content = toContent(request);
			GenerateContentResponse response = client.models.generateContent(request.model(), content, config);
			return response.text();
		} catch (RuntimeException exception) {
			throw new GeminiClientException("Gemini 호출에 실패했습니다.");
		}
	}

	private Content toContent(GeminiGenerationRequest request) {
		List<Part> parts = new ArrayList<>();
		parts.add(Part.fromText(request.prompt()));
		request.media().forEach(media -> parts.add(Part.fromUri(media.uri(), media.mimeType())));
		return Content.fromParts(parts.toArray(new Part[0]));
	}
}
