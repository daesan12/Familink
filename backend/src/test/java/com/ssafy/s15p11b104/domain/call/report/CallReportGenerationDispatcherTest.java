package com.ssafy.s15p11b104.domain.call.report;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CallReportGenerationDispatcherTest {

	@Mock
	private CallReportGenerationService generationService;

	@Test
	void delegatesGeneration() {
		CallReportGenerationDispatcher dispatcher = new CallReportGenerationDispatcher(generationService);

		dispatcher.dispatch(1L);

		verify(generationService).generate(1L);
	}

	@Test
	void isolatesGenerationFailureFromCaller() {
		CallReportGenerationDispatcher dispatcher = new CallReportGenerationDispatcher(generationService);
		doThrow(new CallReportAnalysisException("test-secret")).when(generationService).generate(1L);

		assertThatCode(() -> dispatcher.dispatch(1L)).doesNotThrowAnyException();
	}
}
