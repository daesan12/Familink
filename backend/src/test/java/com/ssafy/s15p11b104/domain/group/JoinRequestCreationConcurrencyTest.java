package com.ssafy.s15p11b104.domain.group;

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
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.entity.JoinRequestStatus;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupJoinRequestRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 같은 사용자가 같은 초대 코드로 동시에 가입 요청할 때의 응답 계약을 검증한다.
 *
 * <p>{@code JoinRequestApiTest}와 달리 클래스에 {@code @Transactional}을 붙이지 않는다. 테스트
 * 트랜잭션 안에서는 준비한 데이터가 커밋되지 않아 다른 스레드에서 보이지 않고, 요청도 테스트
 * 트랜잭션에 합류해 경쟁 자체가 재현되지 않는다.
 *
 * <p>신청자 계정 잠금이 없으면 두 요청이 사전 검사를 모두 통과한 뒤 대기 중 요청을 한 건으로
 * 제한하는 부분 유니크 인덱스에서 한쪽이 실패하고, 그 위반이 계약에 없는 500으로 나타난다.
 */
@AutoConfigureMockMvc
class JoinRequestCreationConcurrencyTest extends IntegrationTest {

	private static final int ATTEMPTS = 20;
	private static final long REQUEST_TIMEOUT_SECONDS = 5;
	private static final String INVITE_CODE = "CRT123";
	private static final String MANAGER_LOGIN_ID = "crt_manager";
	private static final String APPLICANT_LOGIN_ID = "crt_applicant";
	private static final String DUPLICATE_CODE = "JOIN_REQUEST_ALREADY_EXISTS";

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
	private GroupJoinRequestRepository groupJoinRequestRepository;

	private Long groupId;
	private Long applicantUserId;

	@BeforeEach
	void setUp() {
		clearOwnData();
		transactionTemplate.executeWithoutResult(status -> {
			User manager = userRepository.save(user(MANAGER_LOGIN_ID, "관리자"));
			User applicant = userRepository.save(user(APPLICANT_LOGIN_ID, "신청자"));
			FamilyGroup group = familyGroupRepository.save(new FamilyGroup("우리가족", INVITE_CODE));
			groupMemberRepository.save(new GroupMember(group, manager, GroupRole.GUARDIAN, true, Instant.now()));

			groupId = group.getId();
			applicantUserId = applicant.getId();
		});
	}

	@AfterEach
	void tearDown() {
		clearOwnData();
	}

	@Test
	void concurrentRequestsCreateOnePendingRequestAndReportConflict() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
				CountDownLatch start = new CountDownLatch(1);

				Future<Response> first = executor.submit(createRequest(start));
				Future<Response> second = executor.submit(createRequest(start));
				start.countDown();

				Response firstResponse = first.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
				Response secondResponse = second.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);

				assertThat(List.of(firstResponse.status(), secondResponse.status()))
					.as("%d번째 시도: 한 요청만 생성되어야 한다", attempt)
					.containsExactlyInAnyOrder(201, 409);
				assertConflictIsContracted(attempt, firstResponse, secondResponse);
				assertPendingRequestCount(attempt);

				discardAttempt();
			}
		} finally {
			shutDown(executor);
		}
	}

	/**
	 * 실패한 요청은 계약된 중복 오류 코드로 끝나야 한다. 제약 위반이 그대로 올라오면 코드 없는
	 * 500 본문이 되어 이 단정이 깨진다.
	 */
	private void assertConflictIsContracted(int attempt, Response first, Response second) {
		String conflictBody = first.status() == 409 ? first.body() : second.body();
		assertThat(conflictBody)
			.as("%d번째 시도: 실패한 요청은 %s로 끝나야 한다", attempt, DUPLICATE_CODE)
			.contains(DUPLICATE_CODE);
	}

	private void assertPendingRequestCount(int attempt) {
		transactionTemplate.executeWithoutResult(status -> {
			long pending = groupJoinRequestRepository.findAllWithApplicantByGroupIdAndStatus(
				groupId, JoinRequestStatus.PENDING_ADMIN).size();

			assertThat(pending)
				.as("%d번째 시도: 대기 중 요청은 한 건만 남아야 한다", attempt)
				.isEqualTo(1);
		});
	}

	/**
	 * 남은 요청 스레드가 끝날 때까지 기다린다. 잠금 회귀로 요청이 멈추면 그 트랜잭션이 신청자 계정
	 * 행을 계속 쥐고 있어, 기다리지 않으면 뒤따르는 정리 삭제가 그 잠금을 기다리게 된다. 여기서
	 * 단정하지 않는 것은 본문의 실패 원인을 가리지 않기 위해서다.
	 */
	private void shutDown(ExecutorService executor) throws InterruptedException {
		executor.shutdownNow();
		executor.awaitTermination(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
	}

	private Callable<Response> createRequest(CountDownLatch start) {
		return () -> {
			start.await();
			var response = mockMvc.perform(post("/join-requests/by-code")
					.with(authenticatedAs(applicantUserId))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"inviteCode\": \"" + INVITE_CODE + "\"}"))
				.andReturn()
				.getResponse();
			return new Response(response.getStatus(), response.getContentAsString());
		};
	}

	private void discardAttempt() {
		transactionTemplate.executeWithoutResult(status -> deleteByOwnGroup("DELETE FROM group_join_requests"));
	}

	/**
	 * 이 클래스가 만든 행만 지운다. 커밋하는 테스트라 롤백으로 정리되지 않고, 전체 삭제는 다른
	 * 테스트가 남긴 행의 외래 키를 건드릴 수 있다.
	 */
	private void clearOwnData() {
		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
			deleteByOwnGroup("DELETE FROM notifications");
			deleteByOwnGroup("DELETE FROM group_join_requests");
			deleteByOwnGroup("DELETE FROM group_members");
			entityManager.createNativeQuery("DELETE FROM family_groups WHERE invite_code = :inviteCode")
				.setParameter("inviteCode", INVITE_CODE)
				.executeUpdate();
			entityManager.createNativeQuery("DELETE FROM users WHERE login_id in (:loginIds)")
				.setParameter("loginIds", List.of(MANAGER_LOGIN_ID, APPLICANT_LOGIN_ID))
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

	private record Response(int status, String body) {
	}
}
