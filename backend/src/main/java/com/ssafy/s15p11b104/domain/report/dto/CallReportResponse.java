package com.ssafy.s15p11b104.domain.report.dto;

import java.time.Instant;

/**
 * 건별 통화 리포트 조회 응답이다.
 *
 * <p>{@code API-REPORTS-003}을 구현한다. 건별 감정은 일일 리포트 집계에만 쓰고 화면에 표시하지
 * 않으므로 감정 필드를 담지 않으며, 통화 전사도 제공하지 않는다.
 */
public record CallReportResponse(
	Long callSessionId,
	String summary,
	String guardianMessage,
	Instant createdAt) {
}
