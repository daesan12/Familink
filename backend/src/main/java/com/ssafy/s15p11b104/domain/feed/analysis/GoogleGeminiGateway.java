package com.ssafy.s15p11b104.domain.feed.analysis;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.google.genai.types.Schema;
import com.google.genai.types.Type;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiClient;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiClientException;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiGenerationRequest;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiMedia;
import com.ssafy.s15p11b104.global.ai.gemini.GoogleGeminiClient;

@Component
public class GoogleGeminiGateway implements GeminiGateway {

	private static final Schema RESPONSE_SCHEMA = Schema.builder()
		.type(Type.Known.OBJECT)
		.properties(Map.of("summary", Schema.builder().type(Type.Known.STRING).build()))
		.required(List.of("summary"))
		.build();

	private final GeminiClient geminiClient;
	private final DirectGeminiMediaClient directGeminiMediaClient;

	@Autowired
	public GoogleGeminiGateway(
		GeminiClient geminiClient,
		DirectGeminiMediaClient directGeminiMediaClient
	) {
		this.geminiClient = geminiClient;
		this.directGeminiMediaClient = directGeminiMediaClient;
	}

	public GoogleGeminiGateway(String apiKey, String baseUrl) {
		this(new GoogleGeminiClient(apiKey, baseUrl), request -> new GoogleGeminiClient(apiKey, baseUrl)
			.generate(request));
	}

	GoogleGeminiGateway(GeminiClient geminiClient) {
		this(geminiClient, geminiClient::generate);
	}

	@Override
	public String generate(GeminiRequest request) {
		try {
			GeminiGenerationRequest generationRequest = new GeminiGenerationRequest(
				request.model(),
				request.prompt(),
				request.media().stream()
					.map(media -> new GeminiMedia(media.uri(), media.mimeType()))
					.toList(),
				RESPONSE_SCHEMA
			);
			if (request.media().isEmpty()) {
				return geminiClient.generate(generationRequest);
			}
			return directGeminiMediaClient.generate(generationRequest);
		} catch (GeminiClientException exception) {
			throw new GeminiGatewayException(
				exception.getMessage(),
				exception.getFailureCode(),
				exception.isRetryable());
		}
	}
}
