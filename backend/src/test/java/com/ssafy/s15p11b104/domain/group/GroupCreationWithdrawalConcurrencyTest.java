package com.ssafy.s15p11b104.domain.group;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

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
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 그룹 생성과 회원 탈퇴가 겹칠 때 고아 그룹이 생기지 않는지 검증한다.
 *
 * <p>생성자 계정 행을 잠그지 않으면 활성 여부를 확인한 뒤 탈퇴가 커밋되어도 새 관리자 멤버십이
 * 삽입된다. 그 결과 다시 인증할 수 없는 탈퇴자가 유일 관리자인 그룹이 남고, 관리자 API가 모두 막혀
 * 삭제도 위임도 할 수 없다. 외래 키는 {@code withdrawn_at}이나 멤버십 활성 상태를 보장하지 않는다.
 *
 * <p>클래스에 {@code @Transactional}을 붙이지 않는 이유는 준비 데이터가 커밋되어야 다른 스레드에서
 * 보이고, 요청이 테스트 트랜잭션에 합류하면 경쟁이 재현되지 않기 때문이다.
 */
@AutoConfigureMockMvc
class GroupCreationWithdrawalConcurrencyTest extends IntegrationTest {

	private static final int ATTEMPTS = 20;
	private static final long REQUEST_TIMEOUT_SECONDS = 5;
	private static final String LOGIN_ID_PREFIX = "gcw";
	private static final String CREATE_GROUP_BODY = "{\"name\": \"새집\", \"myRole\": \"GUARDIAN\"}";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private TransactionTemplate transactionTemplate;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private UserRepository userRepository;

	private final List<Long> createdUserIds = new ArrayList<>();

	@AfterEach
	void tearDown() {
		clearOwnData();
	}

	@Test
	void concurrentGroupCreationAndWithdrawalLeaveNoOrphanGroup() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
				Long userId = createActiveUser(attempt);
				CountDownLatch start = new CountDownLatch(1);

				Future<Integer> create = executor.submit(createGroup(start, userId));
				Future<Integer> withdraw = executor.submit(withdraw(start, userId));
				start.countDown();

				int createStatus = create.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
				int withdrawStatus = withdraw.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);

				assertThat(List.of(createStatus, withdrawStatus))
					.as("%d번째 시도: 어느 요청도 서버 오류로 끝나면 안 된다", attempt)
					.allSatisfy(statusCode -> assertThat(statusCode).isLessThan(500));
				assertNoOrphanGroup(attempt, userId, createStatus, withdrawStatus);
			}
		} finally {
			shutDown(executor);
		}
	}

	/**
	 * 탈퇴한 계정이 활성 멤버십을 갖는 조합은 남으면 안 된다.
	 *
	 * <p>생성이 먼저 커밋되면 탈퇴는 활성 관리자 멤버십 때문에 거부되고, 탈퇴가 먼저 커밋되면 생성이
	 * 인증 오류로 끝난다. 어느 쪽이 이기는지는 고정하지 않고 두 결과가 서로 어긋나지 않는지만 본다.
	 */
	private void assertNoOrphanGroup(int attempt, Long userId, int createStatus, int withdrawStatus) {
		transactionTemplate.executeWithoutResult(status -> {
			boolean withdrawn = ((Number) entityManager.createNativeQuery("""
					select count(*)
					from users
					where id = :userId
					  and withdrawn_at is not null
					""")
				.setParameter("userId", userId)
				.getSingleResult()).intValue() > 0;
			long activeMemberships = ((Number) entityManager.createNativeQuery("""
					select count(*)
					from group_members
					where user_id = :userId
					  and left_at is null
					""")
				.setParameter("userId", userId)
				.getSingleResult()).longValue();

			assertThat(withdrawn && activeMemberships > 0)
				.as("%d번째 시도: 생성 %d, 탈퇴 %d — 탈퇴한 계정이 활성 관리자로 남았다",
					attempt, createStatus, withdrawStatus)
				.isFalse();
		});
	}

	/**
	 * 남은 요청 스레드가 끝날 때까지 기다린다. 잠금 회귀로 요청이 멈추면 그 트랜잭션이 계정 행을
	 * 계속 쥐고 있어, 기다리지 않으면 뒤따르는 정리 삭제가 그 잠금을 기다리게 된다. 여기서 단정하지
	 * 않는 것은 본문의 실패 원인을 가리지 않기 위해서다.
	 */
	private void shutDown(ExecutorService executor) throws InterruptedException {
		executor.shutdownNow();
		executor.awaitTermination(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
	}

	private Callable<Integer> createGroup(CountDownLatch start, Long userId) {
		return () -> {
			start.await();
			return mockMvc.perform(post("/groups")
					.with(authenticatedAs(userId))
					.contentType(MediaType.APPLICATION_JSON)
					.content(CREATE_GROUP_BODY))
				.andReturn()
				.getResponse()
				.getStatus();
		};
	}

	private Callable<Integer> withdraw(CountDownLatch start, Long userId) {
		return () -> {
			start.await();
			return mockMvc.perform(delete("/users/me")
					.with(authenticatedAs(userId)))
				.andReturn()
				.getResponse()
				.getStatus();
		};
	}

	/**
	 * 시도마다 새 계정을 만든다. 탈퇴한 계정은 익명화되어 재사용할 수 없다.
	 */
	private Long createActiveUser(int attempt) {
		Long userId = transactionTemplate.execute(status -> userRepository.save(new User(
			LOGIN_ID_PREFIX + attempt,
			"password-hash",
			"생성자",
			LocalDate.of(1960, 5, 2),
			UserGender.FEMALE)).getId());
		createdUserIds.add(userId);
		return userId;
	}

	/**
	 * 이 클래스가 만든 계정과 그 계정이 만든 그룹만 지운다. 초대 코드를 서버가 생성하므로 고정
	 * 코드로는 찾을 수 없어 멤버십에서 그룹을 역추적한다.
	 */
	private void clearOwnData() {
		if (createdUserIds.isEmpty()) {
			return;
		}

		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
			deleteByCreatedUsers("DELETE FROM notifications WHERE receiver_user_id in (:userIds)");
			deleteByCreatedUsers("DELETE FROM device_tokens WHERE user_id in (:userIds)");
			deleteCreatedGroups();
			deleteByCreatedUsers("DELETE FROM group_members WHERE user_id in (:userIds)");
			deleteByCreatedUsers("DELETE FROM users WHERE id in (:userIds)");
		});
		createdUserIds.clear();
	}

	private void deleteCreatedGroups() {
		List<?> rows = entityManager.createNativeQuery("""
				select distinct member.group_id
				from group_members member
				where member.user_id in (:userIds)
				""")
			.setParameter("userIds", createdUserIds)
			.getResultList();
		if (rows.isEmpty()) {
			return;
		}

		List<Long> groupIds = rows.stream()
			.map(Number.class::cast)
			.map(Number::longValue)
			.toList();
		entityManager.createNativeQuery("DELETE FROM notifications WHERE group_id in (:groupIds)")
			.setParameter("groupIds", groupIds)
			.executeUpdate();
		entityManager.createNativeQuery("DELETE FROM group_members WHERE group_id in (:groupIds)")
			.setParameter("groupIds", groupIds)
			.executeUpdate();
		entityManager.createNativeQuery("DELETE FROM family_groups WHERE id in (:groupIds)")
			.setParameter("groupIds", groupIds)
			.executeUpdate();
	}

	private void deleteByCreatedUsers(String deleteStatement) {
		entityManager.createNativeQuery(deleteStatement)
			.setParameter("userIds", createdUserIds)
			.executeUpdate();
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		AuthenticatedUser principal = new AuthenticatedUser(userId, "test-access-token");
		return authentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
	}
}
