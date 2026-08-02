package com.ssafy.s15p11b104.domain.call.report;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.mockito.ArgumentMatchers;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.s15p11b104.global.ai.execution.AiTaskExecutor;

@ExtendWith(MockitoExtension.class)
class CallReportGenerationDispatcherTest {

	@Mock
	private CallReportGenerationService generationService;

	@Mock
	private AiTaskExecutor aiTaskExecutor;

	@Test
	void delegatesGeneration() {
		when(aiTaskExecutor.submit(ArgumentMatchers.any())).thenAnswer(invocation -> {
			invocation.<Runnable>getArgument(0).run();
			return true;
		});
		CallReportGenerationDispatcher dispatcher = new CallReportGenerationDispatcher(
			generationService, aiTaskExecutor);

		dispatcher.dispatch(1L);

		verify(generationService).generate(1L);
	}

	@Test
	void isolatesGenerationFailureFromCaller() {
		when(aiTaskExecutor.submit(ArgumentMatchers.any())).thenAnswer(invocation -> {
			invocation.<Runnable>getArgument(0).run();
			return true;
		});
		CallReportGenerationDispatcher dispatcher = new CallReportGenerationDispatcher(
			generationService, aiTaskExecutor);
		doThrow(new CallReportAnalysisException("test-secret")).when(generationService).generate(1L);

		assertThatCode(() -> dispatcher.dispatch(1L)).doesNotThrowAnyException();
	}
}
