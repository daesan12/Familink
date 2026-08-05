package com.ssafy.s15p11b104.domain.report.dto;

public record CallReportStatusResponse(
	Long callSessionId,
	CallReportStatus status) {
}
