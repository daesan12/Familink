package com.ssafy.s15p11b104.domain.feed.analysis;

import com.ssafy.s15p11b104.global.ai.gemini.GeminiGenerationRequest;

public interface DirectGeminiMediaClient {

	String generate(GeminiGenerationRequest request);
}
