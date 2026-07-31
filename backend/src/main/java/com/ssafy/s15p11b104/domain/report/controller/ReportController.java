package com.ssafy.s15p11b104.domain.report.controller;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.report.dto.CallReportResponse;
import com.ssafy.s15p11b104.domain.report.dto.DailyReportResponse;
import com.ssafy.s15p11b104.domain.report.dto.ReportCalendarResponse;
import com.ssafy.s15p11b104.domain.report.service.ReportQueryService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

/**
 * 보호자의 통화 리포트 조회 API다.
 *
 * <p>{@code API-REPORTS-001}~{@code 003}을 구현한다. 계약의 경로가 {@code /groups}와
 * {@code /call-sessions}로 나뉘므로 클래스 레벨 경로를 두지 않는다. 달력은
 * {@code care-receivers}, 일일 리포트는 {@code members} 세그먼트를 쓰는데 이는 계약이 정한 형태
 * 그대로다.
 */
@RestController
@RequestMapping
public class ReportController {

	private static final String CALENDAR_MESSAGE = "리포트 달력 조회 성공";
	private static final String DAILY_MESSAGE = "일일 리포트 조회 성공";
	private static final String CALL_REPORT_MESSAGE = "통화 리포트 조회 성공";

	private final ReportQueryService reportQueryService;

	public ReportController(ReportQueryService reportQueryService) {
		this.reportQueryService = reportQueryService;
	}

	@GetMapping("/groups/{groupId}/care-receivers/{memberId}/reports/calendar")
	public ApiResponse<ReportCalendarResponse> getCalendar(
		@PathVariable Long groupId,
		@PathVariable Long memberId,
		@RequestParam int year,
		@RequestParam int month,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		return ApiResponse.success(
			CALENDAR_MESSAGE,
			reportQueryService.getCalendar(groupId, memberId, year, month, authenticatedUser.id()));
	}

	@GetMapping("/groups/{groupId}/members/{memberId}/reports/daily/{reportDate}")
	public ApiResponse<DailyReportResponse> getDailyReport(
		@PathVariable Long groupId,
		@PathVariable Long memberId,
		@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate reportDate,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		return ApiResponse.success(
			DAILY_MESSAGE,
			reportQueryService.getDailyReport(groupId, memberId, reportDate, authenticatedUser.id()));
	}

	@GetMapping("/call-sessions/{callSessionId}/report")
	public ApiResponse<CallReportResponse> getCallReport(
		@PathVariable Long callSessionId,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		return ApiResponse.success(
			CALL_REPORT_MESSAGE,
			reportQueryService.getCallReport(callSessionId, authenticatedUser.id()));
	}
}
