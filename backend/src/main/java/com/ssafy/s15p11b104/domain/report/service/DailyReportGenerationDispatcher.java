package com.ssafy.s15p11b104.domain.report.service;

import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
public class DailyReportGenerationDispatcher {

	private static final Logger LOGGER = LoggerFactory.getLogger(DailyReportGenerationDispatcher.class);

	private final DailyReportGenerationService generationService;

	public DailyReportGenerationDispatcher(DailyReportGenerationService generationService) {
		this.generationService = generationService;
	}

	@Async
	public void dispatch(LocalDate reportDate) {
		try {
			generationService.generate(reportDate);
		} catch (RuntimeException exception) {
			LOGGER.error(
				"일일 리포트 생성 작업에 실패했습니다. reportDate={}, errorType={}",
				reportDate,
				exception.getClass().getSimpleName()
			);
		}
	}
}
