package com.ssafy.s15p11b104.domain.feed.service;

public interface PostAnalysisFailure {

	String getFailureCode();

	boolean isRetryable();
}
