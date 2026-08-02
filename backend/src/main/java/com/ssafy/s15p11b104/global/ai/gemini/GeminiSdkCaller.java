package com.ssafy.s15p11b104.global.ai.gemini;

@FunctionalInterface
interface GeminiSdkCaller {

	String generate(GeminiGenerationRequest request);
}
