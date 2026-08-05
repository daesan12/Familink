package com.ssafy.s15p11b104.domain.notification.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.calendar.entity.CalendarEvent;
import com.ssafy.s15p11b104.domain.calendar.repository.CalendarEventRepository;
import com.ssafy.s15p11b104.domain.calendar.repository.EventParticipantRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.notification.entity.Notification;
import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;
import com.ssafy.s15p11b104.domain.notification.entity.ReminderSlot;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationCreationStore.Command;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationRepository;

@Service
public class EventReminderService {

	private static final Logger LOGGER = LoggerFactory.getLogger(EventReminderService.class);
	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");
	private static final LocalTime DAY_BEFORE_TIME = LocalTime.of(9, 0);
	private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

	private final CalendarEventRepository calendarEventRepository;
	private final EventParticipantRepository eventParticipantRepository;
	private final GroupMemberRepository groupMemberRepository;
	private final NotificationCreationService notificationCreationService;
	private final NotificationRepository notificationRepository;
	private final TransactionTemplate transactionTemplate;

	public EventReminderService(
		CalendarEventRepository calendarEventRepository,
		EventParticipantRepository eventParticipantRepository,
		GroupMemberRepository groupMemberRepository,
		NotificationCreationService notificationCreationService
	) {
		this(
			calendarEventRepository,
			eventParticipantRepository,
			groupMemberRepository,
			notificationCreationService,
			null,
			null);
	}

	@Autowired
	public EventReminderService(
		CalendarEventRepository calendarEventRepository,
		EventParticipantRepository eventParticipantRepository,
		GroupMemberRepository groupMemberRepository,
		NotificationCreationService notificationCreationService,
		NotificationRepository notificationRepository,
		TransactionTemplate transactionTemplate
	) {
		this.calendarEventRepository = calendarEventRepository;
		this.eventParticipantRepository = eventParticipantRepository;
		this.groupMemberRepository = groupMemberRepository;
		this.notificationCreationService = notificationCreationService;
		this.notificationRepository = notificationRepository;
		this.transactionTemplate = transactionTemplate;
	}

	/**
	 * 기존 일정 알림 호출자와의 호환 진입점이다.
	 *
	 * <p>새 스케줄러는 {@link #createDueReminders(Instant)}를 사용해 도메인 이벤트·푸시 발행까지
	 * 연결한다. 이 메서드는 122번 일정 알림 계약의 직접 저장 경로를 보존해 이미 배포된 호출자와
	 * 회귀 테스트가 같은 중복·수신자 규칙을 유지하도록 한다.
	 */
	public void remind(Instant now) {
		Objects.requireNonNull(now, "now must not be null");
		remindDayBefore(now);
		remindHourBefore(now);
	}

	@Transactional
	public void createDueReminders(Instant now) {
		Instant windowStart = now.minusSeconds(3600);
		LocalDate firstEventDate = LocalDate.ofInstant(windowStart, BUSINESS_ZONE).plusDays(1);
		LocalDate lastEventDate = LocalDate.ofInstant(now, BUSINESS_ZONE).plusDays(1);
		Long afterId = 0L;
		while (true) {
			List<CalendarEvent> candidates = calendarEventRepository.findReminderCandidatesAfterId(
				windowStart.plusSeconds(3600), now.plusSeconds(3600), firstEventDate, lastEventDate,
				afterId, PageRequest.of(0, 100));
			if (candidates.isEmpty()) {
				break;
			}
			Map<Long, List<GroupMember>> activeMembersByGroup = groupMemberRepository
				.findAllActiveByGroupIds(candidates.stream().map(event -> event.getGroup().getId()).collect(Collectors.toSet()))
				.stream().collect(Collectors.groupingBy(member -> member.getGroup().getId()));
			Map<Long, Set<Long>> participantIdsByEvent = new HashMap<>();
			if (!candidates.isEmpty()) {
				eventParticipantRepository.findMemberIdsByEventIds(candidates.stream().map(CalendarEvent::getId).toList())
					.forEach(row -> participantIdsByEvent
						.computeIfAbsent((Long)row[0], ignored -> new HashSet<>()).add((Long)row[1]));
			}
			for (CalendarEvent event : candidates) {
				createIfDue(event, ReminderSlot.DAY_BEFORE, dayBeforeDueAt(event), windowStart, now,
					activeMembersByGroup, participantIdsByEvent);
				if (event.getStartAt() != null) {
					createIfDue(event, ReminderSlot.HOUR_BEFORE, event.getStartAt().minusSeconds(3600), windowStart, now,
						activeMembersByGroup, participantIdsByEvent);
				}
			}
			afterId = candidates.get(candidates.size() - 1).getId();
			if (candidates.size() < 100) {
				break;
			}
		}
	}

	private void createIfDue(
		CalendarEvent event,
		ReminderSlot slot,
		Instant dueAt,
		Instant windowStart,
		Instant now,
		Map<Long, List<GroupMember>> activeMembersByGroup,
		Map<Long, Set<Long>> participantIdsByEvent
	) {
		if (dueAt.isBefore(windowStart)
			|| dueAt.isAfter(now)
			|| event.getReminderScheduleUpdatedAt().isAfter(dueAt)) {
			return;
		}
		if (!StringUtils.hasText(event.getTitle())) {
			LOGGER.error("일정 알림 필수 제목이 없습니다. eventId={}, reminderSlot={}", event.getId(), slot);
			return;
		}

		List<GroupMember> activeMembers = activeMembersByGroup.getOrDefault(event.getGroup().getId(), List.of());
		Set<Long> participantIds = participantIdsByEvent.getOrDefault(event.getId(), Set.of());
		List<GroupMember> receivers = event.isParticipantsSpecified()
			? activeMembers.stream().filter(member -> participantIds.contains(member.getId())).toList()
			: activeMembers;
		String title = slot == ReminderSlot.DAY_BEFORE ? "내일 일정이 있어요" : "곧 일정이 시작돼요";
		String body = slot == ReminderSlot.DAY_BEFORE
			? "\"%s\" 일정이 내일 시작돼요.".formatted(event.getTitle())
			: "\"%s\" 일정이 1시간 후 시작돼요.".formatted(event.getTitle());

		for (GroupMember receiver : receivers) {
			notificationCreationService.create(new Command(
				receiver.getUser().getId(),
				null,
				event.getGroup().getId(),
				null,
				null,
				event.getId(),
				null,
				null,
				NotificationType.EVENT_REMINDER,
				slot,
				title,
				body,
				null));
		}
	}

	private void remindDayBefore(Instant now) {
		Optional<LocalDate> targetDate = EventReminderTimes.dayBeforeTargetDate(now);
		if (targetDate.isEmpty()) {
			return;
		}

		LocalDate eventDate = targetDate.get();
		Instant dueAt = EventReminderTimes.dayBeforeDueAt(eventDate);
		for (CalendarEvent event : calendarEventRepository.findAllDayBeforeReminderTargets(eventDate, dueAt)) {
			notifyLegacyReceivers(event.getId(), ReminderSlot.DAY_BEFORE);
		}
	}

	private void remindHourBefore(Instant now) {
		Instant until = EventReminderTimes.hourBeforeScanUntil(now);
		for (CalendarEvent event : calendarEventRepository.findAllStartingWithin(now, until)) {
			if (event.getUpdatedAt().isAfter(EventReminderTimes.hourBeforeDueAt(event.getStartAt()))) {
				continue;
			}
			notifyLegacyReceivers(event.getId(), ReminderSlot.HOUR_BEFORE);
		}
	}

	private void notifyLegacyReceivers(Long eventId, ReminderSlot reminderSlot) {
		if (notificationRepository == null || transactionTemplate == null) {
			throw new IllegalStateException("legacy reminder dependencies are not configured");
		}

		try {
			transactionTemplate.executeWithoutResult(status -> {
				CalendarEvent event = calendarEventRepository.findById(eventId).orElse(null);
				if (event == null) {
					return;
				}

				List<User> receivers = resolveLegacyReceivers(event);
				Set<Long> alreadyNotified = new HashSet<>(notificationRepository.findReceiverIdsByEventAndSlot(
					eventId, NotificationType.EVENT_REMINDER, reminderSlot));
				List<Notification> reminders = receivers.stream()
					.filter(receiver -> !alreadyNotified.contains(receiver.getId()))
					.map(receiver -> Notification.eventReminder(
						receiver,
						event,
						reminderSlot,
						legacyTitle(reminderSlot),
						legacyBody(event, reminderSlot)))
					.toList();
				if (!reminders.isEmpty()) {
					notificationRepository.saveAll(reminders);
				}
			});
		} catch (RuntimeException exception) {
			LOGGER.error(
				"일정 시작 알림 생성에 실패했습니다. eventId={}, reminderSlot={}, errorType={}",
				eventId,
				reminderSlot,
				exception.getClass().getSimpleName());
		}
	}

	private List<User> resolveLegacyReceivers(CalendarEvent event) {
		if (event.isParticipantsSpecified()) {
			return eventParticipantRepository.findActiveParticipantUsersByEventId(event.getId());
		}
		return groupMemberRepository.findAllActiveByGroupId(event.getGroup().getId()).stream()
			.map(GroupMember::getUser)
			.toList();
	}

	private String legacyTitle(ReminderSlot reminderSlot) {
		return reminderSlot == ReminderSlot.HOUR_BEFORE ? "일정 시작 알림" : "내일 일정 알림";
	}

	private String legacyBody(CalendarEvent event, ReminderSlot reminderSlot) {
		if (reminderSlot == ReminderSlot.HOUR_BEFORE) {
			return "1시간 후 %s에 '%s' 일정이 시작됩니다."
				.formatted(TIME_FORMATTER.format(event.getStartAt().atZone(BUSINESS_ZONE)), event.getTitle());
		}
		if (event.getStartAt() == null) {
			return "내일 '%s' 일정이 있습니다.".formatted(event.getTitle());
		}
		return "내일 %s에 '%s' 일정이 시작됩니다."
			.formatted(TIME_FORMATTER.format(event.getStartAt().atZone(BUSINESS_ZONE)), event.getTitle());
	}

	private Instant dayBeforeDueAt(CalendarEvent event) {
		return event.getEventDate()
			.minusDays(1)
			.atTime(DAY_BEFORE_TIME)
			.atZone(BUSINESS_ZONE)
			.toInstant();
	}
}
