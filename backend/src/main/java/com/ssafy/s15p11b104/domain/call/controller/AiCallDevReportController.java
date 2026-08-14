package com.ssafy.s15p11b104.domain.call.controller;

import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.call.dto.AiCallDevReportResponse;
import com.ssafy.s15p11b104.domain.call.service.AiCallDevReportService;

@RestController
@Profile("local & ai-call-dev")
@RequestMapping("/ai-call/dev/call-sessions")
public class AiCallDevReportController {

	private final AiCallDevReportService reportService;

	public AiCallDevReportController(AiCallDevReportService reportService) {
		this.reportService = reportService;
	}

	@GetMapping("/{callSessionId}/report")
	public AiCallDevReportResponse get(@PathVariable Long callSessionId) {
		return reportService.get(callSessionId);
	}
}
