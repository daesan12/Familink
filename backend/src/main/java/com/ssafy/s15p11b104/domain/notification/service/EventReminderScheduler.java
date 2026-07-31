package com.ssafy.s15p11b104.domain.notification.service;

import java.time.Clock;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class EventReminderScheduler {

	private final EventReminderService eventReminderService;
	private final Clock clock;

	public EventReminderScheduler(EventReminderService eventReminderService, Clock clock) {
		this.eventReminderService = eventReminderService;
		this.clock = clock;
	}

	@Scheduled(
		fixedDelayString = "${app.event-reminder.fixed-delay-ms:60000}",
		initialDelayString = "${app.event-reminder.initial-delay-ms:60000}")
	public void schedule() {
		eventReminderService.createDueReminders(clock.instant());
	}
}
