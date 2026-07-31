package com.ssafy.s15p11b104.domain.notification.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.calendar.entity.CalendarEvent;
import com.ssafy.s15p11b104.domain.calendar.repository.CalendarEventRepository;
import com.ssafy.s15p11b104.domain.calendar.repository.EventParticipantRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.notification.entity.Notification;
import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;
import com.ssafy.s15p11b104.domain.notification.entity.ReminderSlot;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationRepository;

/**
 * 알림 시점이 도래한 일정을 찾아 시작 알림을 생성한다.
 *
 * <p>알림 예약을 따로 저장하지 않고 매번 일정의 현재 모습을 스캔한다. 그래서 일정을 수정하거나
 * 삭제하면 다음 스캔에 자동으로 반영되고, 예약과 일정이 서로 어긋날 수 없다. 중복 발송은
 * {@code uq_event_reminder_notification}과 수신자 비교로 막는다.
 *
 * <p>알림 시점이 이미 지난 뒤에 등록하거나 수정한 일정은 건너뛴다. 사용자가 방금 일정을 다루면서
 * 이미 그 내용을 알고 있으므로 지난 시점의 알림을 몰아서 보내지 않는다.
 */
@Service
public class EventReminderService {

	private static final Logger LOGGER = LoggerFactory.getLogger(EventReminderService.class);
	private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

	private final CalendarEventRepository calendarEventRepository;
	private final EventParticipantRepository eventParticipantRepository;
	private final GroupMemberRepository groupMemberRepository;
	private final NotificationRepository notificationRepository;
	private final TransactionTemplate transactionTemplate;

	public EventReminderService(
		CalendarEventRepository calendarEventRepository,
		EventParticipantRepository eventParticipantRepository,
		GroupMemberRepository groupMemberRepository,
		NotificationRepository notificationRepository,
		TransactionTemplate transactionTemplate
	) {
		this.calendarEventRepository = calendarEventRepository;
		this.eventParticipantRepository = eventParticipantRepository;
		this.groupMemberRepository = groupMemberRepository;
		this.notificationRepository = notificationRepository;
		this.transactionTemplate = transactionTemplate;
	}

	/**
	 * 주어진 시각을 기준으로 두 알림 시점의 대상을 모두 처리한다.
	 */
	public void remind(Instant now) {
		Objects.requireNonNull(now, "now must not be null");
		remindDayBefore(now);
		remindHourBefore(now);
	}

	private void remindDayBefore(Instant now) {
		Optional<LocalDate> targetDate = EventReminderTimes.dayBeforeTargetDate(now);
		if (targetDate.isEmpty()) {
			return;
		}

		LocalDate eventDate = targetDate.get();
		Instant dueAt = EventReminderTimes.dayBeforeDueAt(eventDate);
		for (CalendarEvent event : calendarEventRepository.findAllDayBeforeReminderTargets(eventDate, dueAt)) {
			notifyReceivers(event.getId(), ReminderSlot.DAY_BEFORE);
		}
	}

	private void remindHourBefore(Instant now) {
		Instant until = EventReminderTimes.hourBeforeScanUntil(now);
		for (CalendarEvent event : calendarEventRepository.findAllStartingWithin(now, until)) {
			if (event.getUpdatedAt().isAfter(EventReminderTimes.hourBeforeDueAt(event.getStartAt()))) {
				continue;
			}
			notifyReceivers(event.getId(), ReminderSlot.HOUR_BEFORE);
		}
	}

	/**
	 * 한 일정의 한 알림 시점을 처리한다.
	 *
	 * <p>일정마다 트랜잭션을 열어 저장 단위를 나눈다. 스케줄러는 트랜잭션 밖에서 호출하므로 한
	 * 일정의 저장이 다른 일정과 분리되고, 한 일정의 실패가 나머지 일정의 알림을 막지 않도록 예외를
	 * 여기서 흡수해 다음 스캔이 이어받게 한다. 전파는 기본값이므로 호출자가 이미 트랜잭션 안이면
	 * 그 트랜잭션에 참여한다.
	 *
	 * <p>일정을 다시 읽는 것은 스캔과 저장 사이에 일정이 삭제될 수 있고, 지연 로딩할 연관을
	 * 트랜잭션 안에서 다뤄야 하기 때문이다.
	 */
	private void notifyReceivers(Long eventId, ReminderSlot reminderSlot) {
		try {
			transactionTemplate.executeWithoutResult(status -> {
				CalendarEvent event = calendarEventRepository.findById(eventId).orElse(null);
				if (event == null) {
					return;
				}

				List<User> receivers = resolveReceivers(event);
				Set<Long> alreadyNotified = new HashSet<>(notificationRepository.findReceiverIdsByEventAndSlot(
					eventId, NotificationType.EVENT_REMINDER, reminderSlot));
				List<Notification> reminders = receivers.stream()
					.filter(receiver -> !alreadyNotified.contains(receiver.getId()))
					.map(receiver -> Notification.eventReminder(
						receiver, event, reminderSlot, title(reminderSlot), body(event, reminderSlot)))
					.toList();
				if (reminders.isEmpty()) {
					return;
				}

				notificationRepository.saveAll(reminders);
			});
		} catch (RuntimeException exception) {
			LOGGER.error(
				"일정 시작 알림 생성에 실패했습니다. eventId={}, reminderSlot={}, errorType={}",
				eventId,
				reminderSlot,
				exception.getClass().getSimpleName()
			);
		}
	}

	/**
	 * 알림을 받을 사용자를 결정한다.
	 *
	 * <p>참여자를 지정한 일정은 그 참여자만의 일정이므로 활성 참여자가 한 명도 남지 않으면 그룹
	 * 전체로 넓히지 않고 아무에게도 보내지 않는다.
	 */
	private List<User> resolveReceivers(CalendarEvent event) {
		if (eventParticipantRepository.existsByEventId(event.getId())) {
			return eventParticipantRepository.findActiveParticipantUsersByEventId(event.getId());
		}
		return groupMemberRepository.findAllActiveByGroupId(event.getGroup().getId()).stream()
			.map(GroupMember::getUser)
			.toList();
	}

	private String title(ReminderSlot reminderSlot) {
		if (reminderSlot == ReminderSlot.HOUR_BEFORE) {
			return "일정 시작 알림";
		}
		return "내일 일정 알림";
	}

	private String body(CalendarEvent event, ReminderSlot reminderSlot) {
		if (reminderSlot == ReminderSlot.HOUR_BEFORE) {
			return "1시간 후 %s에 '%s' 일정이 시작됩니다.".formatted(formatStartTime(event), event.getTitle());
		}
		if (event.getStartAt() == null) {
			return "내일 '%s' 일정이 있습니다.".formatted(event.getTitle());
		}
		return "내일 %s에 '%s' 일정이 시작됩니다.".formatted(formatStartTime(event), event.getTitle());
	}

	private String formatStartTime(CalendarEvent event) {
		return TIME_FORMATTER.format(event.getStartAt().atZone(EventReminderTimes.BUSINESS_ZONE));
	}
}
