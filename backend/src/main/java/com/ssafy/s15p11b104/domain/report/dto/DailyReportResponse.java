package com.ssafy.s15p11b104.domain.report.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * 일일 리포트 조회 응답이다.
 *
 * <p>{@code API-REPORTS-002}를 구현한다. 해당 구간에 통화가 없어 일일 리포트를 만들지 않았으면
 * {@code dailyReport}가 {@code null}이며 이는 오류가 아니라 빈 상태다.
 */
public record DailyReportResponse(
	LocalDate date,
	DailyReportSummaryResponse dailyReport,
	List<DailyCallItemResponse> calls) {
}
