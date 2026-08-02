package com.ssafy.s15p11b104.domain.report.service;

import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.global.ai.execution.AiTaskExecutor;

@Component
public class DailyReportGenerationDispatcher {

	private static final Logger LOGGER = LoggerFactory.getLogger(DailyReportGenerationDispatcher.class);

	private final DailyReportGenerationService generationService;
	private final AiTaskExecutor aiTaskExecutor;

	public DailyReportGenerationDispatcher(
		DailyReportGenerationService generationService,
		AiTaskExecutor aiTaskExecutor
	) {
		this.generationService = generationService;
		this.aiTaskExecutor = aiTaskExecutor;
	}

	public void dispatch(LocalDate reportDate) {
		boolean submitted = aiTaskExecutor.submit(() -> generateSafely(reportDate));
		if (!submitted) {
			LOGGER.warn("일일 리포트 생성 작업이 포화된 AI 실행기에서 거부됐습니다. reportDate={}", reportDate);
		}
	}

	private void generateSafely(LocalDate reportDate) {
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
