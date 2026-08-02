package com.ssafy.s15p11b104.domain.feed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

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
 * 같은 그룹의 두 구성원이 서로를 참조하는 쓰기를 동시에 해도 교착이 없는지 검증한다.
 *
 * <p>이 테스트가 고정하는 것은 잠금 대상이 아니라 <b>잠금 모드</b>다. PostgreSQL에서 외래 키 검사는
 * 부모 행에 {@code FOR KEY SHARE}를 걸고, 이는 {@code FOR UPDATE}하고만 충돌한다. 그래서 생성 경로가
 * 자기 멤버십 행을 {@code FOR UPDATE}로 잠그면, 다른 구성원의 멤버십 행을 참조하는 INSERT가 막혀
 * 두 요청이 정반대 순서로 대기하고 PostgreSQL이 교착을 감지해 계약에 없는 500이 된다.
 * {@code FOR NO KEY UPDATE}는 {@code FOR KEY SHARE}와 충돌하지 않으므로 순환이 생기지 않는다.
 *
 * <p><b>일정 생성 테스트가 이 결정을 고정한다.</b> {@code event_participants}가 참여자의
 * {@code group_members} 행을 참조하므로, 잠금 모드를 {@code FOR UPDATE}로 되돌리면 서로를 참여자로
 * 지정한 두 요청이 확실하게 교착한다. 게시글·댓글 테스트는 알림 행만 서로의 {@code users}를
 * 참조하고 이 경로는 계정 행을 잠그지 않으므로 그 자체로 교착하지는 않는다. 두 경로가 잠금 추가 후에도
 * 동시에 성공하는지 확인하는 회귀 테스트다.
 *
 * <p>클래스에 {@code @Transactional}을 붙이지 않는 이유는 준비 데이터가 커밋되어야 다른 스레드에서
 * 보이고, 요청이 테스트 트랜잭션에 합류하면 경쟁이 재현되지 않기 때문이다.
 */
@AutoConfigureMockMvc
class ContentWriteLockCompatibilityTest extends IntegrationTest {

	private static final int ATTEMPTS = 20;
	private static final long REQUEST_TIMEOUT_SECONDS = 5;
	private static final String INVITE_CODE = "CWL123";
	private static final String FIRST_LOGIN_ID = "cwl_first";
	private static final String SECOND_LOGIN_ID = "cwl_second";
	private static final List<String> LOGIN_IDS = List.of(FIRST_LOGIN_ID, SECOND_LOGIN_ID);
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
	private Long firstUserId;
	private Long secondUserId;
	private Long firstMemberId;
	private Long secondMemberId;

	@BeforeEach
	void setUp() {
		clearOwnData();
		transactionTemplate.executeWithoutResult(status -> {
			User first = userRepository.save(user(FIRST_LOGIN_ID, "첫째"));
			User second = userRepository.save(user(SECOND_LOGIN_ID, "둘째"));
			FamilyGroup group = familyGroupRepository.save(new FamilyGroup("우리가족", INVITE_CODE));
			GroupMember firstMember = groupMemberRepository.save(
				new GroupMember(group, first, GroupRole.GUARDIAN, true, Instant.now()));
			GroupMember secondMember = groupMemberRepository.save(
				new GroupMember(group, second, GroupRole.GUARDIAN, false, Instant.now()));

			groupId = group.getId();
			firstUserId = first.getId();
			secondUserId = second.getId();
			firstMemberId = firstMember.getId();
			secondMemberId = secondMember.getId();
		});
	}

	@AfterEach
	void tearDown() {
		clearOwnData();
	}

	@Test
	void concurrentPostCreationsBySameGroupMembersBothSucceed() throws Exception {
		runConcurrently(
			attempt -> createPostRequest(firstUserId),
			attempt -> createPostRequest(secondUserId),
			201,
			"게시글 생성");
	}

	@Test
	void concurrentCommentsOnEachOthersPostsBothSucceed() throws Exception {
		runConcurrently(
			attempt -> commentRequest(createPost(firstMemberId), secondUserId),
			attempt -> commentRequest(createPost(secondMemberId), firstUserId),
			201,
			"댓글 생성");
	}

	@Test
	void concurrentEventCreationsReferencingEachOtherBothSucceed() throws Exception {
		runConcurrently(
			attempt -> createEventRequest(firstUserId, secondMemberId),
			attempt -> createEventRequest(secondUserId, firstMemberId),
			201,
			"일정 생성");
	}

	/**
	 * 두 요청을 같은 순간에 출발시켜 시도마다 둘 다 성공하는지 확인한다.
	 *
	 * <p>요청 본문은 시도마다 새로 만든다. 댓글 사례는 시도마다 새 게시글이 필요하다.
	 */
	private void runConcurrently(
		AttemptRequest firstRequest,
		AttemptRequest secondRequest,
		int expectedStatus,
		String label
	) throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
				CountDownLatch start = new CountDownLatch(1);
				Callable<Integer> byFirst = firstRequest.prepare(attempt).toCallable(start);
				Callable<Integer> bySecond = secondRequest.prepare(attempt).toCallable(start);

				Future<Integer> first = executor.submit(byFirst);
				Future<Integer> second = executor.submit(bySecond);
				start.countDown();

				int firstStatus = first.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
				int secondStatus = second.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);

				assertThat(List.of(firstStatus, secondStatus))
					.as("%d번째 시도: 서로를 알림 수신자로 만드는 %s 두 건이 교착 없이 모두 성공해야 한다",
						attempt, label)
					.containsExactly(expectedStatus, expectedStatus);
			}
		} finally {
			shutDown(executor);
		}
	}

	/**
	 * 남은 요청 스레드가 끝날 때까지 기다린다. 교착 회귀로 요청이 멈추면 그 트랜잭션이 계정·멤버십
	 * 행을 계속 쥐고 있어, 기다리지 않으면 뒤따르는 정리 삭제가 그 잠금을 기다리게 된다. 여기서
	 * 단정하지 않는 것은 본문의 실패 원인을 가리지 않기 위해서다.
	 */
	private void shutDown(ExecutorService executor) throws InterruptedException {
		executor.shutdownNow();
		executor.awaitTermination(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
	}

	private PreparedRequest createPostRequest(Long authorUserId) {
		String body = """
			{
				"groupIds": [%d],
				"content": "동시 작성",
				"media": []
			}
			""".formatted(groupId);
		return new PreparedRequest("/posts", body, authorUserId);
	}

	private PreparedRequest commentRequest(Long postId, Long commenterUserId) {
		return new PreparedRequest(
			"/posts/" + postId + "/comments", "{\"content\": \"동시 댓글\"}", commenterUserId);
	}

	private PreparedRequest createEventRequest(Long creatorUserId, Long participantMemberId) {
		String body = """
			{
				"title": "가족 모임",
				"eventDate": "%s",
				"endDate": "%s",
				"participantMemberIds": [%d]
			}
			""".formatted(EVENT_DATE, EVENT_DATE, participantMemberId);
		return new PreparedRequest("/groups/" + groupId + "/events", body, creatorUserId);
	}

	private Long createPost(Long authorMemberId) {
		return transactionTemplate.execute(status -> postRepository.save(new Post(
			familyGroupRepository.findByInviteCode(INVITE_CODE).orElseThrow(),
			groupMemberRepository.getReferenceById(authorMemberId),
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

	@FunctionalInterface
	private interface AttemptRequest {

		PreparedRequest prepare(int attempt);
	}

	private final class PreparedRequest {

		private final String path;
		private final String body;
		private final Long actingUserId;

		private PreparedRequest(String path, String body, Long actingUserId) {
			this.path = path;
			this.body = body;
			this.actingUserId = actingUserId;
		}

		private Callable<Integer> toCallable(CountDownLatch start) {
			return () -> {
				start.await();
				return mockMvc.perform(post(path)
						.with(authenticatedAs(actingUserId))
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
					.andReturn()
					.getResponse()
					.getStatus();
			};
		}
	}
}
