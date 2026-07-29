package com.ssafy.s15p11b104.domain.feed.analysis;

public class PostContentAnalysisException extends RuntimeException {

	private final AnalysisFailureType type;

	public PostContentAnalysisException(AnalysisFailureType type, String message) {
		super(message);
		this.type = type;
	}

	public AnalysisFailureType getType() {
		return type;
	}
}
