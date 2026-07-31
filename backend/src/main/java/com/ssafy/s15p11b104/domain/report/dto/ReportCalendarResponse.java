package com.ssafy.s15p11b104.domain.report.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * 리포트 달력 조회 응답이다.
 *
 * <p>{@code API-REPORTS-001}을 구현한다. {@code reportDates}는 일일 리포트가 저장된 날짜만 담으므로
 * 보호자가 고른 날짜에는 항상 일일 리포트가 있다.
 */
public record ReportCalendarResponse(String yearMonth, List<LocalDate> reportDates) {
}
