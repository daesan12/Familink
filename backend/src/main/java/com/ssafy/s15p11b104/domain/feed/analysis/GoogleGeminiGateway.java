package com.ssafy.s15p11b104.domain.feed.analysis;

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
import com.google.genai.types.Schema;
import com.google.genai.types.Type;

@Component
public class GoogleGeminiGateway implements GeminiGateway {

	private static final Schema RESPONSE_SCHEMA = Schema.builder()
		.type(Type.Known.OBJECT)
		.properties(Map.of("summary", Schema.builder().type(Type.Known.STRING).build()))
		.required(List.of("summary"))
		.build();

	private final Client client;

	public GoogleGeminiGateway(
		@Value("${gemini.analysis.api-key:}") String apiKey,
		@Value("${gemini.analysis.base-url:https://gms.ssafy.io/gmsapi/generativelanguage.googleapis.com}") String baseUrl) {
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
	public String generate(GeminiRequest request) {
		if (client == null) {
			throw new GeminiGatewayException("Gemini API 키가 설정되지 않았습니다.");
		}

		try {
			GenerateContentConfig config = GenerateContentConfig.builder()
				.responseMimeType("application/json")
				.responseSchema(RESPONSE_SCHEMA)
				.candidateCount(1)
				.build();
			Content content = toContent(request);
			GenerateContentResponse response = client.models.generateContent(request.model(), content, config);
			return response.text();
		} catch (RuntimeException exception) {
			throw new GeminiGatewayException("Gemini 호출에 실패했습니다.");
		}
	}

	private Content toContent(GeminiRequest request) {
		List<Part> parts = new ArrayList<>();
		parts.add(Part.fromText(request.prompt()));
		request.media().forEach(media -> parts.add(Part.fromUri(media.uri(), media.mimeType())));
		return Content.fromParts(parts.toArray(new Part[0]));
	}
}
