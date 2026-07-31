package com.ssafy.s15p11b104.domain.notification.service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Objects;
import java.util.Optional;

/**
 * 일정 시작 알림의 시점을 계산한다.
 *
 * <p>알림 시점은 사용자가 고를 수 없는 고정 규칙이다. 모든 일정은 시작 날짜 전날 09:00
 * {@code Asia/Seoul}에 한 번, 시간 일정은 추가로 시작 1시간 전에 한 번 알린다. 저장과 비교는
 * UTC 절대 시각으로 하고 이 클래스만 업무 시간대를 다룬다.
 */
public final class EventReminderTimes {

	public static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");

	private static final LocalTime DAY_BEFORE_TIME = LocalTime.of(9, 0);
	private static final Duration HOUR_BEFORE_LEAD = Duration.ofHours(1);

	private EventReminderTimes() {
	}

	/**
	 * 시작 날짜 전날 09:00 {@code Asia/Seoul}의 절대 시각을 반환한다.
	 */
	public static Instant dayBeforeDueAt(LocalDate eventDate) {
		Objects.requireNonNull(eventDate, "eventDate must not be null");
		return eventDate.minusDays(1)
			.atTime(DAY_BEFORE_TIME)
			.atZone(BUSINESS_ZONE)
			.toInstant();
	}

	/**
	 * 시간 일정의 시작 1시간 전 절대 시각을 반환한다.
	 */
	public static Instant hourBeforeDueAt(Instant startAt) {
		Objects.requireNonNull(startAt, "startAt must not be null");
		return startAt.minus(HOUR_BEFORE_LEAD);
	}

	/**
	 * 지금 전날 09:00 알림을 보낼 수 있는 시작 날짜를 반환한다.
	 *
	 * <p>업무 시간대로 09:00이 지난 날에는 다음 날 시작 일정이 대상이다. 09:00 이전에는 보낼
	 * 대상이 없으므로 빈 값을 반환한다.
	 */
	public static Optional<LocalDate> dayBeforeTargetDate(Instant now) {
		Objects.requireNonNull(now, "now must not be null");
		var nowInBusinessZone = now.atZone(BUSINESS_ZONE);
		if (nowInBusinessZone.toLocalTime().isBefore(DAY_BEFORE_TIME)) {
			return Optional.empty();
		}
		return Optional.of(nowInBusinessZone.toLocalDate().plusDays(1));
	}

	/**
	 * 시작 1시간 전 알림 후보를 좁힐 조회 상한을 반환한다.
	 */
	public static Instant hourBeforeScanUntil(Instant now) {
		Objects.requireNonNull(now, "now must not be null");
		return now.plus(HOUR_BEFORE_LEAD);
	}
}
