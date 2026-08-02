package com.ssafy.s15p11b104.domain.call.service;

import java.time.Clock;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class CallSessionLeaseScheduler {

	private final CallSessionLeaseService callSessionLeaseService;
	private final SidebandSessionManager sidebandSessionManager;
	private final Clock clock;

	public CallSessionLeaseScheduler(
		CallSessionLeaseService callSessionLeaseService,
		SidebandSessionManager sidebandSessionManager,
		Clock clock
	) {
		this.callSessionLeaseService = callSessionLeaseService;
		this.sidebandSessionManager = sidebandSessionManager;
		this.clock = clock;
	}

	@EventListener(ApplicationReadyEvent.class)
	public void recoverOnStartup() {
		callSessionLeaseService.recoverExpired(clock.instant());
	}

	@Scheduled(
		fixedDelayString = "${app.ai-call-lease.fixed-delay-ms:30000}",
		initialDelayString = "${app.ai-call-lease.initial-delay-ms:30000}")
	public void renewAndRecover() {
		callSessionLeaseService.renewAndRecover(sidebandSessionManager.activeSessionIds(), clock.instant());
	}
}
