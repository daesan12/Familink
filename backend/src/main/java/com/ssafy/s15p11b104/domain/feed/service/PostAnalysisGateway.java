package com.ssafy.s15p11b104.domain.feed.service;

/**
 * 게시글 분석 모듈(예: Gemini)의 내부 진입점이다.
 *
 * <p>예약·상태 저장 로직은 이 인터페이스만 의존하며, 실제 게시글 조회와
 * 모델 호출은 구현 모듈이 담당한다. 외부 HTTP API 없이 Spring 빈으로 연결한다.</p>
 */
@FunctionalInterface
public interface PostAnalysisGateway {

	/**
	 * 게시글을 분석하고 최대 500자 요약을 반환한다.
	 *
	 * @param postId 분석할 게시글 ID
	 * @return 분석 요약
	 */
	String analyze(Long postId);
}
