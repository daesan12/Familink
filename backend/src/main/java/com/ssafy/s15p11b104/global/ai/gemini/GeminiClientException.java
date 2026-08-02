package com.ssafy.s15p11b104.global.ai.gemini;

public class GeminiClientException extends RuntimeException {

	private final GeminiFailureType failureType;
	private final String failureCode;
	private final boolean retryable;

	public GeminiClientException(String message) {
		this(message, GeminiFailureType.UNKNOWN, "UNKNOWN", false, null);
	}

	public GeminiClientException(
		String message,
		GeminiFailureType failureType,
		String failureCode,
		boolean retryable,
		Throwable cause
	) {
		super(message, cause);
		this.failureType = failureType;
		this.failureCode = failureCode;
		this.retryable = retryable;
	}

	public GeminiFailureType getFailureType() {
		return failureType;
	}

	public String getFailureCode() {
		return failureCode;
	}

	public boolean isRetryable() {
		return retryable;
	}
}
