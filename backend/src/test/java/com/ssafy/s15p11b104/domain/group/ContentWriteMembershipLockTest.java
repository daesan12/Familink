package com.ssafy.s15p11b104.domain.group;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

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
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 게시글·댓글·일정 생성이 요청자의 활성 멤버십 행을 잠근 상태에서 검사하는지 검증한다.
 *
 * <p>잠그지 않으면 활성 구성원임을 읽은 뒤 그룹 나가기나 회원 탈퇴가 커밋되고, 그 다음 자원이 저장되어
 * 이미 떠난 구성원 명의의 게시글·댓글·일정이 남는다. 실제 두 요청을 맞부딪히는 방식은 경쟁 창이 좁아
 * 결함을 놓치므로, 여기서는 멤버십 행을 잡은 트랜잭션을 하나 띄워 두고 생성 요청이 그 잠금을
 * 기다리는지 직접 확인한다. 잠금을 빼면 요청이 기다리지 않고 즉시 끝나 이 단정이 깨진다.
 *
 * <p>클래스에 {@code @Transactional}을 붙이지 않는 이유는 준비 데이터가 커밋되어야 다른 스레드에서
 * 보이고, 요청이 테스트 트랜잭션에 합류하면 잠금 경쟁이 재현되지 않기 때문이다.
 */
@AutoConfigureMockMvc
class ContentWriteMembershipLockTest extends IntegrationTest {

	private static final long LOCK_HOLD_SECONDS = 2;
	/** 잠금 신호와 요청 스레드의 타이머 시작 사이 스케줄 지연을 흡수한다. 부하가 큰 CI를 고려해 둔다. */
	private static final long CLOCK_SLACK_MILLIS = 300;
	private static final long REQUEST_TIMEOUT_SECONDS = 10;
	private static final String INVITE_CODE = "CWM123";
	private static final String WRITER_LOGIN_ID = "cwm_writer";
	private static final String OTHER_LOGIN_ID = "cwm_other";
	private static final List<String> LOGIN_IDS = List.of(WRITER_LOGIN_ID, OTHER_LOGIN_ID);
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
	private PostRepository postRepository;

	private Long groupId;
	private Long writerUserId;
	private Long writerMemberId;
	private Long otherMemberId;

	@BeforeEach
	void setUp() {
		clearOwnData();
		transactionTemplate.executeWithoutResult(status -> {
			User writer = userRepository.save(user(WRITER_LOGIN_ID, "작성자"));
			User other = userRepository.save(user(OTHER_LOGIN_ID, "다른 구성원"));
			FamilyGroup group = familyGroupRepository.save(new FamilyGroup("우리가족", INVITE_CODE));
			GroupMember writerMember = groupMemberRepository.save(
				new GroupMember(group, writer, GroupRole.GUARDIAN, true, Instant.now()));
			GroupMember otherMember = groupMemberRepository.save(
				new GroupMember(group, other, GroupRole.GUARDIAN, false, Instant.now()));

			groupId = group.getId();
			writerUserId = writer.getId();
			writerMemberId = writerMember.getId();
			otherMemberId = otherMember.getId();
		});
	}

	@AfterEach
	void tearDown() {
		clearOwnData();
	}

	@Test
	void postCreationWaitsForTheMembershipLock() throws Exception {
		String body = """
			{
				"groupIds": [%d],
				"content": "잠금 대기 확인",
				"media": []
			}
			""".formatted(groupId);
		assertWaitsForMembershipLock("/posts", body, 201);
	}

	@Test
	void commentCreationWaitsForTheMembershipLock() throws Exception {
		Long postId = createPost();
		assertWaitsForMembershipLock(
			"/posts/" + postId + "/comments", "{\"content\": \"잠금 대기 확인\"}", 201);
	}

	@Test
	void eventCreationWaitsForTheMembershipLock() throws Exception {
		String body = """
			{
				"title": "가족 모임",
				"eventDate": "%s",
				"endDate": "%s",
				"participantMemberIds": [%d]
			}
			""".formatted(EVENT_DATE, EVENT_DATE, otherMemberId);
		assertWaitsForMembershipLock("/groups/" + groupId + "/events", body, 201);
	}

	/**
	 * 작성자의 멤버십 행을 잡은 트랜잭션을 띄워 두고 생성 요청을 보낸다. 요청이 잠금 보유 중에
	 * 끝났다면 그 경로는 멤버십 행을 잠그지 않은 것이다.
	 */
	private void assertWaitsForMembershipLock(String path, String body, int expectedStatus) throws Exception {
		warmUp(path);

		ExecutorService executor = Executors.newFixedThreadPool(2);
		CountDownLatch locked = new CountDownLatch(1);
		AtomicLong elapsedMillis = new AtomicLong();
		AtomicInteger responseStatus = new AtomicInteger();

		try {
			Future<?> lockHolder = executor.submit(() -> transactionTemplate.executeWithoutResult(status -> {
				groupMemberRepository.findActiveForUpdateByGroupIdAndUserId(groupId, writerUserId)
					.orElseThrow();
				locked.countDown();
				sleepQuietly(LOCK_HOLD_SECONDS);
			}));

			Future<?> writer = executor.submit(() -> {
				if (!awaitQuietly(locked)) {
					throw new IllegalStateException("멤버십 잠금 신호를 기다리는 시간이 초과되었습니다.");
				}
				long startedAt = System.nanoTime();
				int status = perform(path, body);
				elapsedMillis.set(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt));
				responseStatus.set(status);
			});

			writer.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
			lockHolder.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);

			assertThat(elapsedMillis.get())
				.as("%s 요청이 멤버십 잠금을 기다리지 않고 끝났다. 활성 멤버십 검사가 잠그지 않는다", path)
				.isGreaterThanOrEqualTo(TimeUnit.SECONDS.toMillis(LOCK_HOLD_SECONDS) - CLOCK_SLACK_MILLIS);
			assertThat(responseStatus.get())
				.as("%s 요청은 잠금이 풀린 뒤 정상 처리돼야 한다", path)
				.isEqualTo(expectedStatus);
		} finally {
			executor.shutdownNow();
			executor.awaitTermination(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
		}
	}

	/**
	 * 소요 시간으로 잠금 대기를 판정하므로, 첫 요청의 컨텍스트 준비 시간이 대기 시간과 섞이지 않게
	 * 같은 경로를 한 번 미리 호출한다. 성공 여부는 보지 않는다.
	 */
	private void warmUp(String path) {
		perform(path, "{}");
	}

	private int perform(String path, String body) {
		try {
			return mockMvc.perform(post(path)
					.with(authenticatedAs(writerUserId))
					.contentType(MediaType.APPLICATION_JSON)
					.content(body))
				.andReturn()
				.getResponse()
				.getStatus();
		} catch (Exception exception) {
			throw new IllegalStateException("생성 요청이 실패했습니다.", exception);
		}
	}

	private boolean awaitQuietly(CountDownLatch latch) {
		try {
			return latch.await(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			return false;
		}
	}

	private void sleepQuietly(long seconds) {
		try {
			TimeUnit.SECONDS.sleep(seconds);
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
		}
	}

	private Long createPost() {
		return transactionTemplate.execute(status -> postRepository.save(new Post(
			familyGroupRepository.findByInviteCode(INVITE_CODE).orElseThrow(),
			groupMemberRepository.getReferenceById(writerMemberId),
			"댓글 대상")).getId());
	}

	/**
	 * 이 클래스가 만든 행만 지운다. 커밋하는 테스트라 롤백으로 정리되지 않고, 전체 삭제는 다른
	 * 테스트가 남긴 행의 외래 키를 건드릴 수 있다. 게시글과 일정의 자식 행은 스키마의
	 * {@code ON DELETE CASCADE}로 함께 지워진다.
	 */
	private void clearOwnData() {
		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
			deleteByOwnGroup("DELETE FROM notifications");
			deleteByOwnGroup("DELETE FROM calendar_events");
			deleteByOwnGroup("DELETE FROM posts");
			deleteByOwnGroup("DELETE FROM carnations");
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
