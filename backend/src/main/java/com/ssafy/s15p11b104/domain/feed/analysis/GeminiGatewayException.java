package com.ssafy.s15p11b104.domain.feed.analysis;

public class GeminiGatewayException extends RuntimeException {

	private final String failureCode;
	private final boolean retryable;

	public GeminiGatewayException(String message) {
		this(message, "UNKNOWN", false);
	}

	public GeminiGatewayException(String message, String failureCode, boolean retryable) {
		super(message);
		this.failureCode = failureCode;
		this.retryable = retryable;
	}

	public String getFailureCode() {
		return failureCode;
	}

	public boolean isRetryable() {
		return retryable;
	}
}
