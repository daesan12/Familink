package com.ssafy.s15p11b104.domain.feed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
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
 * 반응 등록과 회원 탈퇴가 겹칠 때 교착이 없는지 검증한다.
 *
 * <p>반응 등록은 원래부터 구성원 행을 잠갔고 같은 트랜잭션에서 알림을 저장한다. 알림 행은 수신자와
 * 행위자 두 방향으로 {@code users}를 참조하므로 INSERT가 계정 행에 {@code FOR KEY SHARE}를 건다.
 * 구성원 행을 {@code FOR UPDATE}로 잠그면 이 경로는 {@code group_members → users} 순으로,
 * 회원 탈퇴는 {@code users → group_members} 순으로 잠금을 요구해 순환이 생긴다. PostgreSQL이 교착을
 * 감지하며 반환하는 오류는 계약에 없는 500이다.
 *
 * <p>잠금 모드를 {@code FOR NO KEY UPDATE}로 낮추면 외래 키 검사가 막히지 않아 순환이 사라진다.
 * 계정 행을 먼저 잠가 공통 순서를 지키는 것도 함께 필요하다.
 *
 * <p>클래스에 {@code @Transactional}을 붙이지 않는 이유는 준비 데이터가 커밋되어야 다른 스레드에서
 * 보이고, 요청이 테스트 트랜잭션에 합류하면 경쟁이 재현되지 않기 때문이다.
 */
@AutoConfigureMockMvc
class ReactionWithdrawalConcurrencyTest extends IntegrationTest {

	private static final int ATTEMPTS = 20;
	private static final long REQUEST_TIMEOUT_SECONDS = 5;
	private static final String INVITE_CODE = "RWC123";
	private static final String AUTHOR_LOGIN_ID = "rwc_author";
	private static final String REACTOR_LOGIN_ID_PREFIX = "rwc_reactor";
	private static final String REACTION_BODY = "{\"reactionType\": \"HEART\"}";

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

	private final List<Long> createdReactorUserIds = new ArrayList<>();

	private Long authorMemberId;

	@BeforeEach
	void setUp() {
		clearOwnData();
		transactionTemplate.executeWithoutResult(status -> {
			User author = userRepository.save(user(AUTHOR_LOGIN_ID, "작성자"));
			FamilyGroup group = familyGroupRepository.save(new FamilyGroup("우리가족", INVITE_CODE));
			authorMemberId = groupMemberRepository.save(
				new GroupMember(group, author, GroupRole.GUARDIAN, true, Instant.now())).getId();
		});
	}

	@AfterEach
	void tearDown() {
		clearOwnData();
	}

	@Test
	void concurrentReactionAndWithdrawalNeverDeadlock() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
				JoinedMember reactor = joinReactor(attempt);
				Long postId = createPost();
				CountDownLatch start = new CountDownLatch(1);

				Future<Integer> react = executor.submit(react(start, postId, reactor.userId()));
				Future<Integer> withdraw = executor.submit(withdraw(start, reactor.userId()));
				start.countDown();

				int reactStatus = react.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
				int withdrawStatus = withdraw.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);

				assertThat(List.of(reactStatus, withdrawStatus))
					.as("%d번째 시도: 어느 요청도 서버 오류로 끝나면 안 된다. 교착이면 500이 된다", attempt)
					.allSatisfy(statusCode -> assertThat(statusCode).isLessThan(500));
				assertThat(withdrawStatus)
					.as("%d번째 시도: 관리자가 아닌 구성원의 탈퇴는 성공해야 한다", attempt)
					.isEqualTo(204);
				assertThat(reactStatus)
					.as("%d번째 시도: 반응 등록은 성공이거나 활성 구성원이 아니라는 거절이어야 한다", attempt)
					.isIn(200, 403);
				assertStoredReactionsMatchResponse(attempt, reactor.memberId(), reactStatus);
			}
		} finally {
			shutDown(executor);
		}
	}

	/**
	 * 응답과 저장 결과가 같아야 한다. 거절했는데 반응이 남아 있거나, 성공했는데 반응이 없으면
	 * 검사와 저장이 직렬화되지 않은 것이다.
	 */
	private void assertStoredReactionsMatchResponse(int attempt, Long reactorMemberId, int reactStatus) {
		transactionTemplate.executeWithoutResult(status -> {
			Number stored = (Number) entityManager.createNativeQuery("""
					select count(*)
					from post_reactions
					where group_member_id = :memberId
					""")
				.setParameter("memberId", reactorMemberId)
				.getSingleResult();

			assertThat(stored.longValue())
				.as("%d번째 시도: 반응 등록 응답 %d와 저장된 반응 수가 어긋난다", attempt, reactStatus)
				.isEqualTo(reactStatus == 200 ? 1 : 0);
		});
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

	private Callable<Integer> react(CountDownLatch start, Long postId, Long reactorUserId) {
		return () -> {
			start.await();
			return mockMvc.perform(put("/posts/" + postId + "/reaction")
					.with(authenticatedAs(reactorUserId))
					.contentType(MediaType.APPLICATION_JSON)
					.content(REACTION_BODY))
				.andReturn()
				.getResponse()
				.getStatus();
		};
	}

	private Callable<Integer> withdraw(CountDownLatch start, Long reactorUserId) {
		return () -> {
			start.await();
			return mockMvc.perform(delete("/users/me")
					.with(authenticatedAs(reactorUserId)))
				.andReturn()
				.getResponse()
				.getStatus();
		};
	}

	/**
	 * 시도마다 새 구성원을 가입시킨다. 탈퇴한 계정은 익명화되어 재사용할 수 없다.
	 */
	private JoinedMember joinReactor(int attempt) {
		return transactionTemplate.execute(status -> {
			User reactor = userRepository.save(
				user(REACTOR_LOGIN_ID_PREFIX + attempt, "반응자" + attempt));
			createdReactorUserIds.add(reactor.getId());
			Long memberId = groupMemberRepository.save(new GroupMember(
				familyGroupRepository.findByInviteCode(INVITE_CODE).orElseThrow(),
				reactor,
				GroupRole.GUARDIAN,
				false,
				Instant.now())).getId();
			return new JoinedMember(memberId, reactor.getId());
		});
	}

	private Long createPost() {
		return transactionTemplate.execute(status -> postRepository.save(new Post(
			familyGroupRepository.findByInviteCode(INVITE_CODE).orElseThrow(),
			groupMemberRepository.getReferenceById(authorMemberId),
			"반응 대상")).getId());
	}

	/**
	 * 이 클래스가 만든 행만 지운다. 커밋하는 테스트라 롤백으로 정리되지 않고, 탈퇴한 계정은
	 * 로그인 ID가 비어 있어 id로만 찾을 수 있다. 게시글의 자식 행은 스키마의
	 * {@code ON DELETE CASCADE}로 함께 지워진다.
	 */
	private void clearOwnData() {
		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
			deleteByOwnGroup("DELETE FROM notifications");
			deleteByOwnGroup("DELETE FROM posts");
			deleteByOwnGroup("DELETE FROM carnations");
			deleteByOwnGroup("DELETE FROM group_join_requests");
			deleteByOwnGroup("DELETE FROM group_members");
			entityManager.createNativeQuery("DELETE FROM family_groups WHERE invite_code = :inviteCode")
				.setParameter("inviteCode", INVITE_CODE)
				.executeUpdate();
			if (!createdReactorUserIds.isEmpty()) {
				entityManager.createNativeQuery("DELETE FROM device_tokens WHERE user_id in (:userIds)")
					.setParameter("userIds", createdReactorUserIds)
					.executeUpdate();
				entityManager.createNativeQuery("DELETE FROM users WHERE id in (:userIds)")
					.setParameter("userIds", createdReactorUserIds)
					.executeUpdate();
			}
			entityManager.createNativeQuery("DELETE FROM users WHERE login_id = :loginId")
				.setParameter("loginId", AUTHOR_LOGIN_ID)
				.executeUpdate();
		});
		createdReactorUserIds.clear();
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

	private record JoinedMember(Long memberId, Long userId) {
	}
}
