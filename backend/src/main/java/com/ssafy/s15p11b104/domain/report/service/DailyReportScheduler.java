package com.ssafy.s15p11b104.domain.report.service;

import java.time.Clock;
import java.time.LocalDate;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class DailyReportScheduler {

	private final DailyReportGenerationDispatcher dispatcher;
	private final Clock clock;

	public DailyReportScheduler(DailyReportGenerationDispatcher dispatcher, Clock clock) {
		this.dispatcher = dispatcher;
		this.clock = clock;
	}

	@Scheduled(cron = "0 0 22 * * *", zone = "Asia/Seoul")
	public void schedule() {
		dispatcher.dispatch(LocalDate.now(clock.withZone(DailyReportWindow.REPORT_ZONE)));
	}
}
