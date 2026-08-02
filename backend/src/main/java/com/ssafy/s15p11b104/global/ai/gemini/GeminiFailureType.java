package com.ssafy.s15p11b104.global.ai.gemini;

public enum GeminiFailureType {
	TIMEOUT,
	RATE_LIMITED,
	SERVER_ERROR,
	CLIENT_ERROR,
	IO_ERROR,
	INTERRUPTED,
	UNKNOWN
}
