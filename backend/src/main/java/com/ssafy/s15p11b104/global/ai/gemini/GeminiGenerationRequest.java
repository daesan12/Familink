package com.ssafy.s15p11b104.global.ai.gemini;

import java.util.List;
import java.util.Objects;

import com.google.genai.types.Schema;

public record GeminiGenerationRequest(
	String model,
	String prompt,
	List<GeminiMedia> media,
	Schema responseSchema
) {

	public GeminiGenerationRequest {
		media = List.copyOf(media);
		Objects.requireNonNull(responseSchema);
	}
}
