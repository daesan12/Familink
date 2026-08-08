package com.ssafy.s15p11b104.domain.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventUpdateRequest;
import com.ssafy.s15p11b104.domain.calendar.entity.CalendarEvent;
import com.ssafy.s15p11b104.domain.calendar.entity.EventParticipant;
import com.ssafy.s15p11b104.domain.calendar.repository.CalendarEventRepository;
import com.ssafy.s15p11b104.domain.calendar.repository.EventParticipantRepository;
import com.ssafy.s15p11b104.domain.calendar.service.CalendarEventService;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.notification.entity.Notification;
import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;
import com.ssafy.s15p11b104.domain.notification.entity.ReminderSlot;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationRepository;
import com.ssafy.s15p11b104.domain.notification.service.EventReminderService;
import com.ssafy.s15p11b104.domain.notification.service.EventReminderTimes;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 일정 시작 알림의 시점·대상자·중복 방지·생략 규칙을 검증한다.
 *
 * <p>스케줄러의 실제 주기를 기다리지 않고 시각을 직접 넘겨 KST 09:00과 시작 1시간 전 경계를
 * 고정한다. 알림 시점이 지난 뒤의 등록·수정을 걸러내는 판정이 일정의 시각 컬럼에 의존하므로
 * 픽스처는 그 값을 네이티브 갱신으로 못 박는다. 판정 컬럼은 경로마다 달라
 * {@code remind}는 {@code updated_at}({@link #stampEvent}), {@code createDueReminders}는
 * {@code reminder_schedule_updated_at}({@link #stampReminderSchedule})을 본다.
 *
 * <p>알림 대상은 일정의 참여자로만 정해진다. 참여자를 넘기지 않은 픽스처는 수신자가 0명이 되므로,
 * 수신자를 검증하는 테스트는 반드시 참여자를 함께 전달해야 단언이 빈 목록에서 통과하지 않는다.
 */
@Transactional
class EventReminderIntegrationTest extends IntegrationTest {

	private static final LocalDate EVENT_DATE = LocalDate.of(2026, 8, 10);

	/** 2026-08-09 09:00:30 {@code Asia/Seoul}. 시작 날짜 전날 09:00을 막 지난 시각이다. */
	private static final Instant JUST_AFTER_DAY_BEFORE_DUE = Instant.parse("2026-08-09T00:00:30Z");

	/** 2026-08-09 08:59:59 {@code Asia/Seoul}. 전날 09:00 직전이다. */
	private static final Instant JUST_BEFORE_DAY_BEFORE_DUE = Instant.parse("2026-08-08T23:59:59Z");

	private static final Instant DAY_BEFORE_DUE_AT = Instant.parse("2026-08-09T00:00:00Z");

	/** 2026-08-10 14:00 {@code Asia/Seoul}. */
	private static final Instant TIMED_EVENT_START_AT = Instant.parse("2026-08-10T05:00:00Z");

	private static final Instant HOUR_BEFORE_DUE_AT = Instant.parse("2026-08-10T04:00:00Z");

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private FamilyGroupRepository familyGroupRepository;

	@Autowired
	private GroupMemberRepository groupMemberRepository;

	@Autowired
	private CalendarEventRepository calendarEventRepository;

	@Autowired
	private EventParticipantRepository eventParticipantRepository;

	@Autowired
	private NotificationRepository notificationRepository;

	@Autowired
	private EventReminderService eventReminderService;

	@Autowired
	private CalendarEventService calendarEventService;

	private User managerUser;
	private User memberUser;
	private User leftUser;
	private User otherGroupUser;
	private FamilyGroup group;
	private GroupMember managerMember;
	private GroupMember memberMember;
	private GroupMember leftMember;

	@BeforeEach
	void setUp() {
		entityManager.createNativeQuery("DELETE FROM notifications").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM device_tokens").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM notification_settings").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM event_participants").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM calendar_events").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM member_interests").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM member_aliases").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM posts").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM group_join_requests").executeUpdate();
		groupMemberRepository.deleteAll();
		familyGroupRepository.deleteAll();
		userRepository.deleteAll();
		entityManager.flush();

		managerUser = userRepository.save(user("rem_manager", "관리자"));
		memberUser = userRepository.save(user("rem_member", "구성원"));
		leftUser = userRepository.save(user("rem_left", "탈퇴자"));
		otherGroupUser = userRepository.save(user("rem_other", "타그룹"));
		group = familyGroupRepository.save(new FamilyGroup("우리가족", "REM123"));
		FamilyGroup otherGroup = familyGroupRepository.save(new FamilyGroup("옆집가족", "REM456"));
		entityManager.flush();

		managerMember = groupMemberRepository.save(
			new GroupMember(group, managerUser, GroupRole.GUARDIAN, true, Instant.now()));
		memberMember = groupMemberRepository.save(
			new GroupMember(group, memberUser, GroupRole.CARE_RECEIVER, false, Instant.now()));
		leftMember = groupMemberRepository.save(
			new GroupMember(group, leftUser, GroupRole.GUARDIAN, false, Instant.now()));
		leftMember.leave(Instant.now());
		groupMemberRepository.save(
			new GroupMember(otherGroup, otherGroupUser, GroupRole.GUARDIAN, true, Instant.now()));
		entityManager.flush();
		entityManager.clear();
	}

	// --- 전날 09:00 알림 ---

	@Test
	void remindsEveryActiveParticipant() {
		Long eventId = persistAllDayEvent("병원 방문", managerMember, memberMember);
		stampEvent(eventId, DAY_BEFORE_DUE_AT.minusSeconds(1));

		eventReminderService.remind(JUST_AFTER_DAY_BEFORE_DUE);

		List<Notification> reminders = notificationRepository.findAll();
		assertThat(reminders).hasSize(2);
		assertThat(reminders).allSatisfy(reminder -> {
			assertThat(reminder.getType()).isEqualTo(NotificationType.EVENT_REMINDER);
			assertThat(reminder.getReminderSlot()).isEqualTo(ReminderSlot.DAY_BEFORE);
			assertThat(reminder.getRelatedEvent().getId()).isEqualTo(eventId);
			assertThat(reminder.getGroup().getId()).isEqualTo(group.getId());
			assertThat(reminder.getTitle()).isEqualTo("내일 일정 알림");
			assertThat(reminder.getBody()).isEqualTo("내일 '병원 방문' 일정이 있습니다.");
			assertThat(reminder.getReadAt()).isNull();
		});
		assertThat(receiverIdsOf(reminders))
			.containsExactlyInAnyOrder(managerUser.getId(), memberUser.getId())
			.doesNotContain(leftUser.getId(), otherGroupUser.getId());
	}

	@Test
	void remindsOnlyActiveParticipantsWhenEventHasParticipants() {
		Long eventId = persistAllDayEvent("가족 모임");
		persistParticipants(eventId, memberMember, leftMember);
		stampEvent(eventId, DAY_BEFORE_DUE_AT.minusSeconds(1));

		eventReminderService.remind(JUST_AFTER_DAY_BEFORE_DUE);

		assertThat(receiverIdsOf(notificationRepository.findAll()))
			.containsExactly(memberUser.getId());
	}

	@Test
	void remindsNobodyWhenEveryParticipantHasLeftTheGroup() {
		Long eventId = persistAllDayEvent("지난 약속");
		persistParticipants(eventId, leftMember);
		stampEvent(eventId, DAY_BEFORE_DUE_AT.minusSeconds(1));

		eventReminderService.remind(JUST_AFTER_DAY_BEFORE_DUE);

		assertThat(notificationRepository.findAll()).isEmpty();
	}

	@Test
	void remindsNobodyWhenParticipantLinkWasRemovedByMembershipChange() {
		Long eventId = persistAllDayEvent("참여자 없는 약속");
		persistParticipants(eventId, memberMember);
		eventParticipantRepository.deleteAllByGroupIdAndMemberId(group.getId(), memberMember.getId());
		entityManager.flush();
		entityManager.clear();
		stampEvent(eventId, DAY_BEFORE_DUE_AT.minusSeconds(1));

		eventReminderService.remind(JUST_AFTER_DAY_BEFORE_DUE);

		assertThat(notificationRepository.findAll()).isEmpty();
	}

	@Test
	void remindsNobodyWhenEventHasNoParticipant() {
		Long eventId = persistAllDayEvent("참여자를 고르지 않은 일정");
		stampEvent(eventId, DAY_BEFORE_DUE_AT.minusSeconds(1));

		eventReminderService.remind(JUST_AFTER_DAY_BEFORE_DUE);

		assertThat(notificationRepository.findAll()).isEmpty();
	}

	@Test
	void skipsDayBeforeReminderWhenEventChangedAfterItsDueTime() {
		Long eventId = persistAllDayEvent("당일 등록", managerMember, memberMember);
		stampEvent(eventId, DAY_BEFORE_DUE_AT.plusSeconds(1));

		eventReminderService.remind(JUST_AFTER_DAY_BEFORE_DUE);

		assertThat(notificationRepository.findAll()).isEmpty();
	}

	@Test
	void skipsDayBeforeReminderBeforeNineInBusinessZone() {
		Long eventId = persistAllDayEvent("병원 방문", managerMember, memberMember);
		stampEvent(eventId, DAY_BEFORE_DUE_AT.minusSeconds(1));

		eventReminderService.remind(JUST_BEFORE_DAY_BEFORE_DUE);

		assertThat(notificationRepository.findAll()).isEmpty();
	}

	@Test
	void describesStartTimeInDayBeforeReminderOfTimedEvent() {
		Long eventId = persistTimedEvent("병원 방문", managerMember, memberMember);
		stampEvent(eventId, DAY_BEFORE_DUE_AT.minusSeconds(1));

		eventReminderService.remind(JUST_AFTER_DAY_BEFORE_DUE);

		assertThat(notificationRepository.findAll())
			.hasSize(2)
			.allSatisfy(reminder -> assertThat(reminder.getBody())
				.isEqualTo("내일 14:00에 '병원 방문' 일정이 시작됩니다."));
	}

	// --- 스케줄러가 실제로 호출하는 경로 ---

	/**
	 * 운영 스케줄러는 {@code remind}가 아니라 {@code createDueReminders}를 호출한다. 알림 대상 정책이
	 * 이 경로에서도 참여자로 한정되는지 DB 수준에서 고정한다.
	 */
	@Test
	void createDueRemindersNotifiesOnlyParticipants() {
		Long eventId = persistAllDayEvent("병원 방문", memberMember);
		stampReminderSchedule(eventId, DAY_BEFORE_DUE_AT.minusSeconds(1));

		eventReminderService.createDueReminders(JUST_AFTER_DAY_BEFORE_DUE);

		assertThat(receiverIdsOf(eventReminders()))
			.containsExactly(memberUser.getId())
			.doesNotContain(managerUser.getId(), leftUser.getId(), otherGroupUser.getId());
	}

	@Test
	void createDueRemindersNotifiesNobodyWhenEventHasNoParticipant() {
		Long eventId = persistAllDayEvent("참여자를 고르지 않은 일정");
		stampReminderSchedule(eventId, DAY_BEFORE_DUE_AT.minusSeconds(1));

		eventReminderService.createDueReminders(JUST_AFTER_DAY_BEFORE_DUE);

		assertThat(eventReminders()).isEmpty();
	}

	// --- 시작 1시간 전 알림 ---

	@Test
	void remindsOneHourBeforeTimedEventStarts() {
		Long eventId = persistTimedEvent("병원 방문", managerMember, memberMember);
		stampEvent(eventId, HOUR_BEFORE_DUE_AT.minusSeconds(1));

		eventReminderService.remind(HOUR_BEFORE_DUE_AT.plusSeconds(600));

		List<Notification> reminders = notificationRepository.findAll();
		assertThat(reminders).hasSize(2);
		assertThat(reminders).allSatisfy(reminder -> {
			assertThat(reminder.getReminderSlot()).isEqualTo(ReminderSlot.HOUR_BEFORE);
			assertThat(reminder.getRelatedEvent().getId()).isEqualTo(eventId);
			assertThat(reminder.getTitle()).isEqualTo("일정 시작 알림");
			assertThat(reminder.getBody()).isEqualTo("1시간 후 14:00에 '병원 방문' 일정이 시작됩니다.");
		});
	}

	@Test
	void skipsHourBeforeReminderWhenEventChangedInsideTheLastHour() {
		Long eventId = persistTimedEvent("급한 약속", managerMember, memberMember);
		Instant halfAnHourBeforeStart = TIMED_EVENT_START_AT.minusSeconds(1800);
		stampEvent(eventId, halfAnHourBeforeStart);

		eventReminderService.remind(halfAnHourBeforeStart);

		assertThat(notificationRepository.findAll()).isEmpty();
	}

	@Test
	void neverRemindsOneHourBeforeAllDayEvent() {
		Long eventId = persistAllDayEvent("하루종일 일정", managerMember, memberMember);
		stampEvent(eventId, HOUR_BEFORE_DUE_AT.minusSeconds(1));

		eventReminderService.remind(HOUR_BEFORE_DUE_AT.plusSeconds(600));

		assertThat(notificationRepository.findAll()).isEmpty();
	}

	@Test
	void remindsTimedEventTwiceAcrossBothDueTimes() {
		Long eventId = persistTimedEvent("병원 방문", managerMember, memberMember);
		stampEvent(eventId, DAY_BEFORE_DUE_AT.minusSeconds(1));

		eventReminderService.remind(JUST_AFTER_DAY_BEFORE_DUE);
		eventReminderService.remind(HOUR_BEFORE_DUE_AT.plusSeconds(600));

		List<Notification> reminders = notificationRepository.findAll();
		assertThat(reminders).hasSize(4);
		assertThat(reminders.stream().filter(this::isDayBefore).count()).isEqualTo(2);
		assertThat(reminders.stream().filter(reminder -> !isDayBefore(reminder)).count()).isEqualTo(2);
	}

	// --- 중복 방지 ---

	@Test
	void remindsOncePerReceiverWhenScannedRepeatedly() {
		Long eventId = persistAllDayEvent("병원 방문", managerMember, memberMember);
		stampEvent(eventId, DAY_BEFORE_DUE_AT.minusSeconds(1));

		eventReminderService.remind(JUST_AFTER_DAY_BEFORE_DUE);
		eventReminderService.remind(JUST_AFTER_DAY_BEFORE_DUE.plusSeconds(60));

		assertThat(receiverIdsOf(notificationRepository.findAll()))
			.containsExactlyInAnyOrder(managerUser.getId(), memberUser.getId());
	}

	/**
	 * 새로 가입한 구성원은 기존 일정의 참여자가 아니므로 그 일정의 알림을 받지 않는다.
	 */
	@Test
	void doesNotRemindNewlyJoinedMemberWhoIsNotAParticipant() {
		Long eventId = persistAllDayEvent("병원 방문", managerMember, memberMember);
		stampEvent(eventId, DAY_BEFORE_DUE_AT.minusSeconds(1));
		eventReminderService.remind(JUST_AFTER_DAY_BEFORE_DUE);

		User joinedUser = userRepository.save(user("rem_joined", "새 구성원"));
		groupMemberRepository.save(
			new GroupMember(group, joinedUser, GroupRole.GUARDIAN, false, Instant.now()));
		entityManager.flush();

		eventReminderService.remind(JUST_AFTER_DAY_BEFORE_DUE.plusSeconds(60));

		assertThat(receiverIdsOf(notificationRepository.findAll()))
			.containsExactlyInAnyOrder(managerUser.getId(), memberUser.getId())
			.doesNotContain(joinedUser.getId());
	}

	// --- 일정 수정 후 재생성 ---

	/**
	 * 시작 날짜를 미래로 옮겨도 기존 알림 ledger는 삭제하지 않고, 같은 슬롯을 중복 생성하지 않는다.
	 */
	@Test
	void keepsExistingReminderWhenEventDateMovesForward() {
		Long eventId = persistAllDayEvent("병원 방문", managerMember, memberMember);
		stampEvent(eventId, DAY_BEFORE_DUE_AT.minusSeconds(1));
		eventReminderService.remind(JUST_AFTER_DAY_BEFORE_DUE);
		assertThat(notificationRepository.findAll()).hasSize(2);

		LocalDate movedDate = EVENT_DATE.plusDays(10);
		calendarEventService.update(
			eventId,
			new CalendarEventUpdateRequest(
				"병원 방문",
				null,
				movedDate,
				movedDate,
				null,
				null,
				List.of(managerMember.getId(), memberMember.getId())),
			managerUser.getId());
		stampEvent(eventId, DAY_BEFORE_DUE_AT.minusSeconds(1));

		assertThat(eventReminders()).hasSize(2);

		Instant justAfterMovedDueAt = movedDate.minusDays(1)
			.atTime(9, 0, 30)
			.atZone(EventReminderTimes.BUSINESS_ZONE)
			.toInstant();
		eventReminderService.remind(justAfterMovedDueAt);

		assertThat(receiverIdsOf(eventReminders()))
			.containsExactlyInAnyOrder(managerUser.getId(), memberUser.getId());
	}

	/**
	 * 같은 날 안에서 시작 시각만 옮긴 수정은 전날 09:00 알림을 그대로 둔다.
	 *
	 * <p>그 알림의 시점은 바뀌지 않았고 이미 지났으므로, 지우면 대체될 것 없이 사라진다.
	 */
	@Test
	void keepsDayBeforeReminderWhenOnlyStartTimeMovesWithinTheSameDate() {
		Long eventId = persistTimedEvent("병원 방문", managerMember, memberMember);
		stampEvent(eventId, DAY_BEFORE_DUE_AT.minusSeconds(1));
		eventReminderService.remind(JUST_AFTER_DAY_BEFORE_DUE);
		assertThat(notificationRepository.findAll()).hasSize(2);

		Instant movedStartAt = TIMED_EVENT_START_AT.plusSeconds(3600);
		calendarEventService.update(
			eventId,
			new CalendarEventUpdateRequest(
				"병원 방문",
				null,
				null,
				null,
				movedStartAt,
				movedStartAt.plusSeconds(3600),
				List.of(managerMember.getId(), memberMember.getId())),
			managerUser.getId());

		assertThat(receiverIdsOf(eventReminders()))
			.containsExactlyInAnyOrder(managerUser.getId(), memberUser.getId());
	}

	// --- 픽스처 ---

	private boolean isDayBefore(Notification reminder) {
		return reminder.getReminderSlot() == ReminderSlot.DAY_BEFORE;
	}

	private List<Notification> eventReminders() {
		return notificationRepository.findAll().stream()
			.filter(notification -> notification.getType() == NotificationType.EVENT_REMINDER)
			.toList();
	}

	private List<Long> receiverIdsOf(List<Notification> reminders) {
		return reminders.stream()
			.map(reminder -> reminder.getReceiver().getId())
			.toList();
	}

	/**
	 * 일정을 저장하고 전달한 구성원을 참여자로 연결한다.
	 *
	 * <p>알림 대상은 참여자로만 정해지므로, 참여자를 넘기지 않으면 수신자가 0명이 된다. 수신자를
	 * 검증하는 테스트는 반드시 참여자를 함께 전달해야 단언이 빈 목록에서 통과하지 않는다.
	 */
	private Long persistAllDayEvent(String title, GroupMember... participants) {
		CalendarEvent event = calendarEventRepository.save(
			new CalendarEvent(group, managerMember, title, null, EVENT_DATE, EVENT_DATE, null, null));
		entityManager.flush();
		entityManager.clear();
		return withParticipants(event.getId(), participants);
	}

	private Long persistTimedEvent(String title, GroupMember... participants) {
		CalendarEvent event = calendarEventRepository.save(new CalendarEvent(
			group,
			managerMember,
			title,
			null,
			EVENT_DATE,
			EVENT_DATE,
			TIMED_EVENT_START_AT,
			TIMED_EVENT_START_AT.plusSeconds(3600)));
		entityManager.flush();
		entityManager.clear();
		return withParticipants(event.getId(), participants);
	}

	private Long withParticipants(Long eventId, GroupMember... participants) {
		if (participants.length > 0) {
			persistParticipants(eventId, participants);
		}
		return eventId;
	}

	private void persistParticipants(Long eventId, GroupMember... members) {
		CalendarEvent event = calendarEventRepository.findById(eventId).orElseThrow();
		for (GroupMember member : members) {
			eventParticipantRepository.save(new EventParticipant(event, member));
		}
		entityManager.flush();
		entityManager.clear();
	}

	/**
	 * 일정의 등록·수정 시각을 고정한다.
	 *
	 * <p>{@code @PrePersist}가 넣는 실제 시각으로는 알림 시점과의 선후를 검증할 수 없다. 네이티브
	 * 갱신은 영속성 컨텍스트를 우회하므로 오래된 엔티티가 남지 않도록 비운다.
	 */
	/**
	 * 일정의 알림 시점 기준 시각을 고정한다.
	 *
	 * <p>{@link EventReminderService#createDueReminders(Instant)}는 {@code updated_at}이 아니라
	 * {@code reminder_schedule_updated_at}으로 지난 시점을 판정하므로 {@link #stampEvent}와 대상
	 * 컬럼이 다르다. 생성자가 넣는 실제 시각에 맡기면 테스트가 실행 날짜에 따라 갈린다.
	 */
	private void stampReminderSchedule(Long eventId, Instant reminderScheduleUpdatedAt) {
		entityManager.flush();
		entityManager.createNativeQuery(
				"UPDATE calendar_events SET reminder_schedule_updated_at = :stampedAt WHERE id = :eventId")
			.setParameter("stampedAt", reminderScheduleUpdatedAt)
			.setParameter("eventId", eventId)
			.executeUpdate();
		entityManager.flush();
		entityManager.clear();
	}

	private void stampEvent(Long eventId, Instant updatedAt) {
		entityManager.flush();
		entityManager.createNativeQuery(
				"UPDATE calendar_events SET created_at = :stampedAt, updated_at = :stampedAt WHERE id = :eventId")
			.setParameter("stampedAt", updatedAt)
			.setParameter("eventId", eventId)
			.executeUpdate();
		entityManager.flush();
		entityManager.clear();
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1960, 5, 2), UserGender.FEMALE);
	}
}
