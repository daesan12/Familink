package com.ssafy.s15p11b104.domain.call.report;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.global.ai.execution.AiTaskExecutor;

@Component
public class CallReportGenerationDispatcher {

	private static final Logger LOGGER = LoggerFactory.getLogger(CallReportGenerationDispatcher.class);

	private final CallReportGenerationService generationService;
	private final AiTaskExecutor aiTaskExecutor;

	public CallReportGenerationDispatcher(
		CallReportGenerationService generationService,
		AiTaskExecutor aiTaskExecutor
	) {
		this.generationService = generationService;
		this.aiTaskExecutor = aiTaskExecutor;
	}

	public void dispatch(Long callSessionId) {
		boolean submitted = aiTaskExecutor.submit(() -> generateSafely(callSessionId));
		if (!submitted) {
			LOGGER.warn("통화 리포트 생성 작업이 포화된 AI 실행기에서 거부됐습니다. callSessionId={}", callSessionId);
		}
	}

	private void generateSafely(Long callSessionId) {
		try {
			generationService.generate(callSessionId);
		} catch (RuntimeException exception) {
			LOGGER.error(
				"통화 리포트 생성에 실패했습니다. callSessionId={}, errorType={}",
				callSessionId,
				exception.getClass().getSimpleName()
			);
		}
	}
}
