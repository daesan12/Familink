package com.ssafy.s15p11b104.domain.notification.service;

import java.time.Clock;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 주기적으로 일정 시작 알림 대상을 확인한다.
 *
 * <p>시작 1시간 전 알림은 시각이 일정마다 달라 고정된 시간표로 표현할 수 없으므로 두 알림 시점을
 * 하나의 폴링으로 함께 처리한다. 폴링은 어느 한 번을 놓쳐도 남은 시간 안에서 다음 실행이
 * 이어받으므로 재시작이나 배포와 겹쳐 그날 알림이 통째로 사라지지 않는다.
 */
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
		eventReminderService.remind(clock.instant());
	}
}
