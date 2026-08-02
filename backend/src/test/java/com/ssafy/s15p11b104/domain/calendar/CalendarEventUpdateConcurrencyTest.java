package com.ssafy.s15p11b104.domain.calendar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.calendar.entity.CalendarEvent;
import com.ssafy.s15p11b104.domain.calendar.repository.CalendarEventRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 같은 일정을 동시에 전체 갱신할 때 참여자 교체 의미가 지켜지는지 검증한다.
 *
 * <p>일정 행을 잠그지 않으면 두 요청이 각자 기존 참여자를 지운 뒤 각자 목록을 넣어 두 목록의
 * 합집합이 남거나 한쪽 목록이 사라지고, 겹치는 참여자는 {@code uq_event_participants_event_member}
 * 위반으로 계약에 없는 오류가 된다.
 *
 * <p>클래스에 {@code @Transactional}을 붙이지 않는 이유는 준비 데이터가 커밋되어야 다른 스레드에서
 * 보이고, 요청이 테스트 트랜잭션에 합류하면 경쟁이 재현되지 않기 때문이다.
 */
@AutoConfigureMockMvc
class CalendarEventUpdateConcurrencyTest extends IntegrationTest {

	private static final int ATTEMPTS = 20;
	private static final long REQUEST_TIMEOUT_SECONDS = 5;
	private static final String INVITE_CODE = "CEU123";
	private static final String MANAGER_LOGIN_ID = "ceu_manager";
	private static final String AUTHOR_LOGIN_ID = "ceu_author";
	private static final String FIRST_LOGIN_ID = "ceu_first";
	private static final String SECOND_LOGIN_ID = "ceu_second";
	private static final List<String> LOGIN_IDS =
		List.of(MANAGER_LOGIN_ID, AUTHOR_LOGIN_ID, FIRST_LOGIN_ID, SECOND_LOGIN_ID);
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

	@Autowired
	private GroupMemberRepository groupMemberRepository;

	@Autowired
	private CalendarEventRepository calendarEventRepository;

	private Long managerUserId;
	private Long authorUserId;
	private Long authorMemberId;
	private Long firstCandidateMemberId;
	private Long secondCandidateMemberId;

	@BeforeEach
	void setUp() {
		clearOwnData();
		transactionTemplate.executeWithoutResult(status -> {
			User manager = userRepository.save(user(MANAGER_LOGIN_ID, "관리자"));
			User author = userRepository.save(user(AUTHOR_LOGIN_ID, "작성자"));
			User first = userRepository.save(user(FIRST_LOGIN_ID, "후보1"));
			User second = userRepository.save(user(SECOND_LOGIN_ID, "후보2"));
			FamilyGroup group = familyGroupRepository.save(new FamilyGroup("우리가족", INVITE_CODE));

			groupMemberRepository.save(new GroupMember(group, manager, GroupRole.GUARDIAN, true, Instant.now()));
			GroupMember authorMember = groupMemberRepository.save(
				new GroupMember(group, author, GroupRole.GUARDIAN, false, Instant.now()));
			GroupMember firstMember = groupMemberRepository.save(
				new GroupMember(group, first, GroupRole.GUARDIAN, false, Instant.now()));
			GroupMember secondMember = groupMemberRepository.save(
				new GroupMember(group, second, GroupRole.CARE_RECEIVER, false, Instant.now()));

			managerUserId = manager.getId();
			authorUserId = author.getId();
			authorMemberId = authorMember.getId();
			firstCandidateMemberId = firstMember.getId();
			secondCandidateMemberId = secondMember.getId();
		});
	}

	@AfterEach
	void tearDown() {
		clearOwnData();
	}

	@Test
	void concurrentUpdatesKeepExactlyOneRequestedParticipantList() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
				Long eventId = createEvent();
				CountDownLatch start = new CountDownLatch(1);

				Future<Integer> byAuthor = executor.submit(
					update(start, eventId, authorUserId, firstCandidateMemberId));
				Future<Integer> byManager = executor.submit(
					update(start, eventId, managerUserId, secondCandidateMemberId));
				start.countDown();

				int authorStatus = byAuthor.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
				int managerStatus = byManager.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);

				assertThat(List.of(authorStatus, managerStatus))
					.as("%d번째 시도: 직렬화되면 두 요청 모두 성공해야 한다", attempt)
					.containsExactly(200, 200);
				assertParticipantsAreOneRequestedList(attempt, eventId);

				discardAttempt(eventId);
			}
		} finally {
			shutDown(executor);
		}
	}

	/**
	 * 남은 참여자는 두 요청 중 한쪽 목록과 정확히 같아야 한다. 합집합이면 두 명이 남는다.
	 */
	private void assertParticipantsAreOneRequestedList(int attempt, Long eventId) {
		transactionTemplate.executeWithoutResult(status -> {
			List<?> rows = entityManager.createNativeQuery("""
					select group_member_id
					from event_participants
					where event_id = :eventId
					""")
				.setParameter("eventId", eventId)
				.getResultList();
			List<Long> participants = rows.stream()
				.map(Number.class::cast)
				.map(Number::longValue)
				.toList();

			assertThat(participants)
				.as("%d번째 시도: 참여자 전체 교체가 합집합이 되었다", attempt)
				.hasSize(1);
			assertThat(participants.get(0))
				.as("%d번째 시도: 남은 참여자가 두 요청 중 어느 쪽도 아니다", attempt)
				.isIn(firstCandidateMemberId, secondCandidateMemberId);
		});
	}

	/**
	 * 남은 요청 스레드가 끝날 때까지 기다린다. 잠금 회귀로 요청이 멈추면 그 트랜잭션이 일정 행을
	 * 계속 쥐고 있어, 기다리지 않으면 뒤따르는 정리 삭제가 그 잠금을 기다리게 된다. 여기서 단정하지
	 * 않는 것은 본문의 실패 원인을 가리지 않기 위해서다.
	 */
	private void shutDown(ExecutorService executor) throws InterruptedException {
		executor.shutdownNow();
		executor.awaitTermination(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
	}

	private Callable<Integer> update(CountDownLatch start, Long eventId, Long editorUserId, Long participantId) {
		String body = """
			{
				"title": "가족 모임",
				"eventDate": "%s",
				"endDate": "%s",
				"participantMemberIds": [%d]
			}
			""".formatted(EVENT_DATE, EVENT_DATE, participantId);
		return () -> {
			start.await();
			return mockMvc.perform(patch("/events/" + eventId)
					.with(authenticatedAs(editorUserId))
					.contentType(MediaType.APPLICATION_JSON)
					.content(body))
				.andReturn()
				.getResponse()
				.getStatus();
		};
	}

	/**
	 * 시도마다 참여자가 없는 새 일정을 만든다. 빈 참여자 목록에서 시작해야 두 요청의 삭제가 모두
	 * 0건이 되는 경쟁 조건이 재현된다.
	 */
	private Long createEvent() {
		return transactionTemplate.execute(status -> calendarEventRepository.save(new CalendarEvent(
			familyGroupRepository.findByInviteCode(INVITE_CODE).orElseThrow(),
			groupMemberRepository.getReferenceById(authorMemberId),
			"옛 제목",
			null,
			EVENT_DATE,
			EVENT_DATE,
			null,
			null,
			Instant.now())).getId());
	}

	private void discardAttempt(Long eventId) {
		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
			entityManager.createNativeQuery("DELETE FROM notifications WHERE related_event_id = :eventId")
				.setParameter("eventId", eventId)
				.executeUpdate();
			entityManager.createNativeQuery("DELETE FROM event_participants WHERE event_id = :eventId")
				.setParameter("eventId", eventId)
				.executeUpdate();
			entityManager.createNativeQuery("DELETE FROM calendar_events WHERE id = :eventId")
				.setParameter("eventId", eventId)
				.executeUpdate();
		});
	}

	/**
	 * 이 클래스가 만든 행만 지운다. 커밋하는 테스트라 롤백으로 정리되지 않고, 전체 삭제는 다른
	 * 테스트가 남긴 행의 외래 키를 건드릴 수 있다.
	 */
	private void clearOwnData() {
		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
			entityManager.createNativeQuery("""
					DELETE FROM event_participants
					WHERE event_id IN (
						SELECT id FROM calendar_events
						WHERE group_id IN (SELECT id FROM family_groups WHERE invite_code = :inviteCode))
					""")
				.setParameter("inviteCode", INVITE_CODE)
				.executeUpdate();
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
