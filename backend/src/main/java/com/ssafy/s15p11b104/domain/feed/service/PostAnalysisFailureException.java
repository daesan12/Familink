package com.ssafy.s15p11b104.domain.feed.service;

public class PostAnalysisFailureException extends RuntimeException implements PostAnalysisFailure {

	private final String failureCode;
	private final boolean retryable;

	public PostAnalysisFailureException(String message, String failureCode, boolean retryable) {
		super(message);
		this.failureCode = failureCode;
		this.retryable = retryable;
	}

	@Override
	public String getFailureCode() {
		return failureCode;
	}

	@Override
	public boolean isRetryable() {
		return retryable;
	}
}
