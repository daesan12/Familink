package com.ssafy.s15p11b104.domain.feed.analysis;

import com.ssafy.s15p11b104.domain.feed.service.PostAnalysisFailure;

public class PostContentAnalysisException extends RuntimeException implements PostAnalysisFailure {

	private final AnalysisFailureType type;
	private final String failureCode;
	private final boolean retryable;

	public PostContentAnalysisException(AnalysisFailureType type, String message) {
		this(type, message, type.name(), false);
	}

	public PostContentAnalysisException(
		AnalysisFailureType type,
		String message,
		String failureCode,
		boolean retryable
	) {
		super(message);
		this.type = type;
		this.failureCode = failureCode;
		this.retryable = retryable;
	}

	public AnalysisFailureType getType() {
		return type;
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
