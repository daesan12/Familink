package com.ssafy.s15p11b104.domain.report.service;

import java.time.Clock;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class DailyReportGenerationClaimCleanupScheduler {

	private final DailyReportGenerationClaimCleanupService cleanupService;
	private final Clock clock;

	public DailyReportGenerationClaimCleanupScheduler(
		DailyReportGenerationClaimCleanupService cleanupService,
		Clock clock
	) {
		this.cleanupService = cleanupService;
		this.clock = clock;
	}

	@Scheduled(
		fixedDelayString = "${app.daily-report.claim-cleanup-delay-ms:60000}",
		initialDelayString = "${app.daily-report.claim-cleanup-initial-delay-ms:60000}")
	public void cleanup() {
		cleanupService.cleanup(clock.instant());
	}
}
