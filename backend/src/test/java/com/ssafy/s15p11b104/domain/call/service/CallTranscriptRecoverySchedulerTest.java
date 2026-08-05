package com.ssafy.s15p11b104.domain.call.service;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.s15p11b104.domain.call.report.CallReportGenerationDispatcher;

@ExtendWith(MockitoExtension.class)
class CallTranscriptRecoverySchedulerTest {

	@Mock
	private CallTranscriptService callTranscriptService;

	@Mock
	private CallReportGenerationDispatcher callReportGenerationDispatcher;

	private CallTranscriptRecoveryScheduler scheduler;

	@BeforeEach
	void setUp() {
		scheduler = new CallTranscriptRecoveryScheduler(
			callTranscriptService,
			callReportGenerationDispatcher
		);
	}

	@Test
	void dispatchesRecoveredReportRequestsImmediatelyOnStartup() {
		when(callTranscriptService.reconcileStaleFinalizations()).thenReturn(List.of(11L, 12L));

		scheduler.recoverFinalizationOnStartup();

		verify(callReportGenerationDispatcher).dispatch(11L);
		verify(callReportGenerationDispatcher).dispatch(12L);
	}

	@Test
	void reconcilesEventsBeforeDispatchingRecoveredReportRequests() {
		when(callTranscriptService.reconcileReady()).thenReturn(List.of(12L));
		when(callTranscriptService.reconcileStaleFinalizations()).thenReturn(List.of(13L));

		scheduler.recover();

		InOrder order = inOrder(callTranscriptService, callReportGenerationDispatcher);
		order.verify(callTranscriptService).reconcileReady();
		order.verify(callReportGenerationDispatcher).dispatch(12L);
		order.verify(callTranscriptService).reconcileStaleFinalizations();
		order.verify(callReportGenerationDispatcher).dispatch(13L);
	}

	@Test
	void delegatesPayloadCleanup() {
		scheduler.cleanupPayloads();

		verify(callTranscriptService).cleanupExpiredPayloads();
	}
}
