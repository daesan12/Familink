package com.ssafy.s15p11b104.domain.call.report;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
public class CallReportGenerationDispatcher {

	private static final Logger LOGGER = LoggerFactory.getLogger(CallReportGenerationDispatcher.class);

	private final CallReportGenerationService generationService;

	public CallReportGenerationDispatcher(CallReportGenerationService generationService) {
		this.generationService = generationService;
	}

	@Async
	public void dispatch(Long callSessionId) {
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
