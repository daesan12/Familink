package com.ssafy.s15p11b104.domain.calendar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.calendar.entity.CalendarEvent;
import com.ssafy.s15p11b104.domain.calendar.entity.EventParticipant;
import com.ssafy.s15p11b104.domain.calendar.repository.CalendarEventRepository;
import com.ssafy.s15p11b104.domain.calendar.repository.EventParticipantRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 일정 참여자 저장과 구성원 이탈이 겹쳐도 비활성 구성원의 연결이 다시 생기지 않는지 검증한다.
 */
@AutoConfigureMockMvc
class CalendarParticipantDepartureConcurrencyTest extends IntegrationTest {

	private static final long REQUEST_TIMEOUT_SECONDS = 5;
	private static final String INVITE_CODE = "CPD123";
	private static final String MANAGER_LOGIN_ID = "cpd_manager";
	private static final String TARGET_LOGIN_ID = "cpd_target";
	private static final List<String> LOGIN_IDS = List.of(MANAGER_LOGIN_ID, TARGET_LOGIN_ID);
	private static final LocalDate EVENT_DATE = LocalDate.of(2026, 9, 1);

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private TransactionTemplate transactionTemplate;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private FamilyGroupRepository familyGroupRepository;

	@MockitoSpyBean
	private GroupMemberRepository groupMemberRepository;

	@Autowired
	private CalendarEventRepository calendarEventRepository;

	@MockitoSpyBean
	private EventParticipantRepository eventParticipantRepository;

	private Long groupId;
	private Long managerUserId;
	private Long managerMemberId;
	private Long targetUserId;
	private Long targetMemberId;
	private Long eventId;

	@BeforeEach
	void setUp() {
		clearOwnData();
		transactionTemplate.executeWithoutResult(status -> {
			User manager = userRepository.save(user(MANAGER_LOGIN_ID, "관리자"));
			User target = userRepository.save(user(TARGET_LOGIN_ID, "이탈 대상"));
			FamilyGroup group = familyGroupRepository.save(new FamilyGroup("동시성 가족", INVITE_CODE));
			GroupMember targetMember = groupMemberRepository.save(
				new GroupMember(group, target, GroupRole.CARE_RECEIVER, false, Instant.now()));
			GroupMember managerMember = groupMemberRepository.save(
				new GroupMember(group, manager, GroupRole.GUARDIAN, true, Instant.now()));

			groupId = group.getId();
			managerUserId = manager.getId();
			managerMemberId = managerMember.getId();
			targetUserId = target.getId();
			targetMemberId = targetMember.getId();
			eventId = calendarEventRepository.save(new CalendarEvent(
				group,
				managerMember,
				"기존 일정",
				null,
				EVENT_DATE,
				EVENT_DATE,
				null,
				null,
				Instant.now())).getId();
		});
	}

	@AfterEach
	void tearDown() {
		clearOwnData();
	}

	@Test
	void departureWaitsForParticipantSaveAndThenRemovesTheNewLink() throws Exception {
		CountDownLatch participantSaveEntered = new CountDownLatch(1);
		CountDownLatch allowParticipantSave = new CountDownLatch(1);
		CountDownLatch departureLockEntered = new CountDownLatch(1);

		doAnswer(invocation -> {
			participantSaveEntered.countDown();
			if (!allowParticipantSave.await(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
				throw new IllegalStateException("일정 참여자 저장 대기 시간이 초과되었습니다.");
			}
			List<EventParticipant> participants = invocation.getArgument(0);
			participants.forEach(entityManager::persist);
			return participants;
		}).when(eventParticipantRepository).saveAll(anyList());
		doAnswer(invocation -> {
			departureLockEntered.countDown();
			return invocation.callRealMethod();
		}).when(groupMemberRepository).findActiveForUpdateByGroupIdAndUserId(eq(groupId), eq(targetUserId));

		try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
			CompletableFuture<Integer> update = CompletableFuture.supplyAsync(this::performUpdate, executor);
			assertThat(participantSaveEntered.await(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)).isTrue();

			CompletableFuture<Integer> departure = CompletableFuture.supplyAsync(this::performDeparture, executor);
			assertThat(departureLockEntered.await(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)).isTrue();
			try {
				assertThatThrownBy(() -> departure.get(500, TimeUnit.MILLISECONDS))
					.isInstanceOf(TimeoutException.class);
			} finally {
				allowParticipantSave.countDown();
			}

			assertThat(update.join()).isEqualTo(200);
			assertThat(departure.join()).isEqualTo(204);
		}

		assertFinalState();
	}

	@Test
	void adminRemovalWaitsForParticipantSaveAndThenRemovesTheNewLink() throws Exception {
		CountDownLatch participantSaveEntered = new CountDownLatch(1);
		CountDownLatch allowParticipantSave = new CountDownLatch(1);
		CountDownLatch removalLockEntered = new CountDownLatch(1);

		doAnswer(invocation -> {
			participantSaveEntered.countDown();
			if (!allowParticipantSave.await(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
				throw new IllegalStateException("일정 참여자 저장 대기 시간이 초과되었습니다.");
			}
			List<EventParticipant> participants = invocation.getArgument(0);
			participants.forEach(entityManager::persist);
			return participants;
		}).when(eventParticipantRepository).saveAll(anyList());
		doAnswer(invocation -> {
			removalLockEntered.countDown();
			return invocation.callRealMethod();
		}).when(groupMemberRepository).findAllForManagerWrite(eq(groupId), anyCollection());

		try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
			CompletableFuture<Integer> update = CompletableFuture.supplyAsync(this::performUpdate, executor);
			assertThat(participantSaveEntered.await(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)).isTrue();

			CompletableFuture<Integer> removal = CompletableFuture.supplyAsync(this::performAdminRemoval, executor);
			assertThat(removalLockEntered.await(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)).isTrue();
			try {
				assertThatThrownBy(() -> removal.get(500, TimeUnit.MILLISECONDS))
					.isInstanceOf(TimeoutException.class);
			} finally {
				allowParticipantSave.countDown();
			}

			assertThat(update.join()).isEqualTo(200);
			assertThat(removal.join()).isEqualTo(204);
		}

		assertFinalState();
	}

	private int performUpdate() {
		String body = """
			{
				"title": "가족 모임",
				"eventDate": "%s",
				"endDate": "%s",
				"participantMemberIds": [%d, %d]
			}
			""".formatted(EVENT_DATE, EVENT_DATE, managerMemberId, targetMemberId);
		try {
			return mockMvc.perform(patch("/events/" + eventId)
					.with(authenticatedAs(managerUserId))
					.contentType(MediaType.APPLICATION_JSON)
					.content(body))
				.andReturn()
				.getResponse()
				.getStatus();
		} catch (Exception exception) {
			throw new IllegalStateException(exception);
		}
	}

	private int performDeparture() {
		try {
			return mockMvc.perform(delete("/groups/" + groupId + "/leave")
					.with(authenticatedAs(targetUserId)))
				.andReturn()
				.getResponse()
				.getStatus();
		} catch (Exception exception) {
			throw new IllegalStateException(exception);
		}
	}

	private int performAdminRemoval() {
		try {
			return mockMvc.perform(delete("/groups/" + groupId + "/members/" + targetMemberId)
					.with(authenticatedAs(managerUserId)))
				.andReturn()
				.getResponse()
				.getStatus();
		} catch (Exception exception) {
			throw new IllegalStateException(exception);
		}
	}

	private void assertFinalState() {
		transactionTemplate.executeWithoutResult(status -> {
			List<?> rows = entityManager.createNativeQuery("""
					select group_member_id
					from event_participants
					where event_id = :eventId
					order by group_member_id
					""")
				.setParameter("eventId", eventId)
				.getResultList();
			List<Long> participants = rows.stream()
				.map(Number.class::cast)
				.map(Number::longValue)
				.toList();

			assertThat(participants).containsExactly(managerMemberId);
			assertThat(calendarEventRepository.existsById(eventId)).isTrue();
			assertThat(groupMemberRepository.findById(targetMemberId).orElseThrow().getLeftAt()).isNotNull();
		});
	}

	private void clearOwnData() {
		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
			deleteByOwnGroup("DELETE FROM notifications");
			deleteByOwnGroup("DELETE FROM calendar_events");
			deleteByOwnGroup("DELETE FROM group_join_requests");
			deleteByOwnGroup("DELETE FROM group_members");
			entityManager.createNativeQuery("DELETE FROM family_groups WHERE invite_code = :inviteCode")
				.setParameter("inviteCode", INVITE_CODE)
				.executeUpdate();
			entityManager.createNativeQuery("DELETE FROM users WHERE login_id in (:loginIds)")
				.setParameter("loginIds", LOGIN_IDS)
				.executeUpdate();
		});
	}

	private void deleteByOwnGroup(String deleteClause) {
		entityManager.createNativeQuery(deleteClause
				+ " WHERE group_id IN (SELECT id FROM family_groups WHERE invite_code = :inviteCode)")
			.setParameter("inviteCode", INVITE_CODE)
			.executeUpdate();
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		AuthenticatedUser principal = new AuthenticatedUser(userId, "test-access-token");
		return authentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1960, 5, 2), UserGender.FEMALE);
	}
}
