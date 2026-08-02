package com.ssafy.s15p11b104.domain.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;

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
 * 프로필 수정과 회원 탈퇴가 겹칠 때 탈퇴 결과가 유지되는지 검증한다.
 *
 * <p>계정 행을 잠그지 않으면 프로필 수정이 활성 계정을 읽은 뒤 탈퇴가 커밋되고, 그 뒤 flush되는
 * 낡은 엔티티의 전체 UPDATE가 {@code withdrawn_at}을 비우고 익명화된 개인정보를 되살린다. 이
 * 프로젝트는 {@code @Version}과 {@code @DynamicUpdate}를 쓰지 않으므로 모든 컬럼이 UPDATE에 담긴다.
 *
 * <p>클래스에 {@code @Transactional}을 붙이지 않는 이유는 준비 데이터가 커밋되어야 다른 스레드에서
 * 보이고, 요청이 테스트 트랜잭션에 합류하면 경쟁이 재현되지 않기 때문이다.
 */
@AutoConfigureMockMvc
class ProfileWithdrawalConcurrencyTest extends IntegrationTest {

	private static final int ATTEMPTS = 20;
	private static final long REQUEST_TIMEOUT_SECONDS = 5;
	private static final String LOGIN_ID_PREFIX = "pwc";
	private static final String UPDATE_BODY = "{\"name\": \"바뀐이름\"}";

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
	void concurrentProfileUpdateNeverRevivesWithdrawnAccount() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
				Long userId = createActiveUser(attempt);
				CountDownLatch start = new CountDownLatch(1);

				Future<Integer> update = executor.submit(updateProfile(start, userId));
				Future<Integer> withdraw = executor.submit(withdraw(start, userId));
				start.countDown();

				int updateStatus = update.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
				int withdrawStatus = withdraw.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);

				assertThat(List.of(updateStatus, withdrawStatus))
					.as("%d번째 시도: 어느 요청도 서버 오류로 끝나면 안 된다", attempt)
					.allSatisfy(statusCode -> assertThat(statusCode).isLessThan(500));
				assertThat(withdrawStatus)
					.as("%d번째 시도: 그룹이 없는 계정의 탈퇴는 성공해야 한다", attempt)
					.isEqualTo(204);
				assertAccountStaysWithdrawn(attempt, userId);
			}
		} finally {
			shutDown(executor);
		}
	}

	/**
	 * 탈퇴가 성공했으면 계정은 탈퇴 상태로 남고 개인정보는 모두 비어 있어야 한다. 프로필 수정이
	 * 낡은 값으로 덮어쓰면 이 단정이 깨진다.
	 */
	private void assertAccountStaysWithdrawn(int attempt, Long userId) {
		transactionTemplate.executeWithoutResult(status -> {
			Object[] row = (Object[]) entityManager.createNativeQuery("""
					select withdrawn_at, login_id, password_hash, name, birth_date, gender, profile_image_url
					from users
					where id = :userId
					""")
				.setParameter("userId", userId)
				.getSingleResult();

			assertThat(row[0])
				.as("%d번째 시도: 탈퇴 시각이 되살아났다", attempt)
				.isNotNull();
			assertThat(row)
				.as("%d번째 시도: 익명화된 개인정보가 되살아났다", attempt)
				.containsExactly(row[0], null, null, null, null, null, null);
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

	private Callable<Integer> updateProfile(CountDownLatch start, Long userId) {
		return () -> {
			start.await();
			return mockMvc.perform(patch("/users/me")
					.with(authenticatedAs(userId))
					.contentType(MediaType.APPLICATION_JSON)
					.content(UPDATE_BODY))
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
			"원래이름",
			LocalDate.of(1960, 5, 2),
			UserGender.FEMALE)).getId());
		createdUserIds.add(userId);
		return userId;
	}

	/**
	 * 이 클래스가 만든 계정만 지운다. 커밋하는 테스트라 롤백으로 정리되지 않고, 탈퇴한 계정은
	 * 로그인 ID가 비어 있어 id로만 찾을 수 있다.
	 */
	private void clearOwnData() {
		if (createdUserIds.isEmpty()) {
			return;
		}

		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
			deleteByCreatedUsers("DELETE FROM notifications WHERE receiver_user_id in (:userIds)");
			deleteByCreatedUsers("DELETE FROM device_tokens WHERE user_id in (:userIds)");
			deleteByCreatedUsers("DELETE FROM group_members WHERE user_id in (:userIds)");
			deleteByCreatedUsers("DELETE FROM users WHERE id in (:userIds)");
		});
		createdUserIds.clear();
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
