package com.ssafy.s15p11b104.domain.call.service;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class CallTranscriptRecoveryScheduler {

	private final CallTranscriptService callTranscriptService;

	public CallTranscriptRecoveryScheduler(CallTranscriptService callTranscriptService) {
		this.callTranscriptService = callTranscriptService;
	}

	@EventListener(ApplicationReadyEvent.class)
	public void recoverFinalizationOnStartup() {
		callTranscriptService.reconcileStaleFinalizations();
	}

	@Scheduled(
		fixedDelayString = "${app.transcript-recovery.fixed-delay-ms:60000}",
		initialDelayString = "${app.transcript-recovery.initial-delay-ms:60000}")
	public void recover() {
		callTranscriptService.reconcileReady();
		callTranscriptService.reconcileStaleFinalizations();
	}

	@Scheduled(
		fixedDelayString = "${app.transcript-recovery.cleanup-delay-ms:3600000}",
		initialDelayString = "${app.transcript-recovery.cleanup-initial-delay-ms:3600000}")
	public void cleanupPayloads() {
		callTranscriptService.cleanupExpiredPayloads();
	}
}
