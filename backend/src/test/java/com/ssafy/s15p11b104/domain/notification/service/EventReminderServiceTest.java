package com.ssafy.s15p11b104.domain.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.calendar.entity.CalendarEvent;
import com.ssafy.s15p11b104.domain.calendar.repository.CalendarEventRepository;
import com.ssafy.s15p11b104.domain.calendar.repository.EventParticipantRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.notification.entity.ReminderSlot;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationCreationStore.Command;

@ExtendWith(MockitoExtension.class)
class EventReminderServiceTest {

	private static final Instant NOW = Instant.parse("2026-08-01T00:30:00Z");

	@Mock
	private CalendarEventRepository calendarEventRepository;

	@Mock
	private EventParticipantRepository eventParticipantRepository;

	@Mock
	private GroupMemberRepository groupMemberRepository;

	@Mock
	private NotificationCreationService notificationCreationService;

	@InjectMocks
	private EventReminderService reminderService;

	@Test
	void createsDayBeforeReminderForAllDayEventWithoutParticipants() {
		FamilyGroup group = group(10L);
		CalendarEvent event = event(
			20L,
			group,
			"병원 방문",
			LocalDate.of(2026, 8, 2),
			null,
			Instant.parse("2026-07-31T23:00:00Z"));
		GroupMember first = member(11L, 101L);
		GroupMember second = member(12L, 102L);
		when(calendarEventRepository.findReminderCandidates(
			NOW,
			NOW.plusSeconds(3600),
			LocalDate.of(2026, 8, 2),
			LocalDate.of(2026, 8, 2)))
			.thenReturn(List.of(event));
		when(groupMemberRepository.findAllActiveByGroupId(10L)).thenReturn(List.of(first, second));
		when(eventParticipantRepository.findMemberIdsByEventId(20L)).thenReturn(List.of());

		reminderService.createDueReminders(NOW);

		ArgumentCaptor<Command> captor = ArgumentCaptor.forClass(Command.class);
		verify(notificationCreationService, org.mockito.Mockito.times(2)).create(captor.capture());
		assertThat(captor.getAllValues()).extracting(Command::receiverUserId)
			.containsExactlyInAnyOrder(101L, 102L);
		assertThat(captor.getAllValues()).extracting(Command::reminderSlot)
			.containsOnly(ReminderSlot.DAY_BEFORE);
		assertThat(captor.getAllValues()).extracting(Command::sourceEventKey)
			.containsOnlyNulls();
	}

	@Test
	void createsHourBeforeReminderForCurrentActiveParticipantsOnly() {
		FamilyGroup group = group(10L);
		CalendarEvent event = event(
			20L,
			group,
			"복약",
			LocalDate.of(2026, 8, 1),
			Instant.parse("2026-08-01T01:00:00Z"),
			Instant.parse("2026-07-31T23:00:00Z"));
		GroupMember first = member(11L, 101L);
		GroupMember second = member(12L, 102L);
		when(calendarEventRepository.findReminderCandidates(
			NOW,
			NOW.plusSeconds(3600),
			LocalDate.of(2026, 8, 2),
			LocalDate.of(2026, 8, 2)))
			.thenReturn(List.of(event));
		when(groupMemberRepository.findAllActiveByGroupId(10L)).thenReturn(List.of(first, second));
		when(eventParticipantRepository.findMemberIdsByEventId(20L)).thenReturn(List.of(12L));

		reminderService.createDueReminders(NOW);

		ArgumentCaptor<Command> captor = ArgumentCaptor.forClass(Command.class);
		verify(notificationCreationService).create(captor.capture());
		assertThat(captor.getValue().receiverUserId()).isEqualTo(102L);
		assertThat(captor.getValue().reminderSlot()).isEqualTo(ReminderSlot.HOUR_BEFORE);
		assertThat(captor.getValue().body()).isEqualTo("\"복약\" 일정이 1시간 후 시작돼요.");
	}

	@Test
	void skipsReminderWhenScheduleWasChangedAfterItsDueTime() {
		FamilyGroup group = group(10L);
		CalendarEvent event = event(
			20L,
			group,
			"늦게 변경된 일정",
			LocalDate.of(2026, 8, 1),
			Instant.parse("2026-08-01T01:00:00Z"),
			Instant.parse("2026-08-01T00:10:00Z"));
		when(calendarEventRepository.findReminderCandidates(
			NOW,
			NOW.plusSeconds(3600),
			LocalDate.of(2026, 8, 2),
			LocalDate.of(2026, 8, 2)))
			.thenReturn(List.of(event));

		reminderService.createDueReminders(NOW);

		verifyNoInteractions(notificationCreationService);
	}

	private FamilyGroup group(Long id) {
		FamilyGroup group = mock(FamilyGroup.class);
		lenient().when(group.getId()).thenReturn(id);
		return group;
	}

	private CalendarEvent event(
		Long id,
		FamilyGroup group,
		String title,
		LocalDate eventDate,
		Instant startAt,
		Instant reminderScheduleUpdatedAt
	) {
		CalendarEvent event = mock(CalendarEvent.class);
		lenient().when(event.getId()).thenReturn(id);
		lenient().when(event.getGroup()).thenReturn(group);
		lenient().when(event.getTitle()).thenReturn(title);
		lenient().when(event.getEventDate()).thenReturn(eventDate);
		lenient().when(event.getStartAt()).thenReturn(startAt);
		lenient().when(event.getReminderScheduleUpdatedAt()).thenReturn(reminderScheduleUpdatedAt);
		return event;
	}

	private GroupMember member(Long memberId, Long userId) {
		GroupMember member = mock(GroupMember.class);
		User user = mock(User.class);
		lenient().when(member.getId()).thenReturn(memberId);
		lenient().when(member.getUser()).thenReturn(user);
		lenient().when(user.getId()).thenReturn(userId);
		return member;
	}
}
