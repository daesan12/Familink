package com.ssafy.s15p11b104.domain.call.report;

import java.time.Clock;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class CallReportGenerationRecoveryScheduler {

	private static final int BATCH_SIZE = 20;

	private final CallReportGenerationRequestRepository requestRepository;
	private final CallReportGenerationDispatcher dispatcher;
	private final Clock clock;

	public CallReportGenerationRecoveryScheduler(
		CallReportGenerationRequestRepository requestRepository,
		CallReportGenerationDispatcher dispatcher,
		Clock clock
	) {
		this.requestRepository = requestRepository;
		this.dispatcher = dispatcher;
		this.clock = clock;
	}

	@Scheduled(
		fixedDelayString = "${app.call-report-generation.recovery-delay-ms:60000}",
		initialDelayString = "${app.call-report-generation.recovery-initial-delay-ms:60000}")
	public void recover() {
		List<Long> callSessionIds = requestRepository.findDispatchableIds(
			CallReportGenerationStatus.PENDING,
			CallReportGenerationStatus.CLAIMED,
			clock.instant(),
			PageRequest.of(0, BATCH_SIZE)
		);
		callSessionIds.forEach(dispatcher::dispatch);
	}
}
