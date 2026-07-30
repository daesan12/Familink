package com.ssafy.s15p11b104.domain.report.service;

import java.util.List;

public record DailyReportInput(List<CallReportContext> callReports) {

	public DailyReportInput {
		callReports = List.copyOf(callReports);
	}

	public record CallReportContext(String summary, String guardianMessage) {
	}
}
