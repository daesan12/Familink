package com.ssafy.s15p11b104.domain.group;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

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
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 관심사 동시 전체 교체가 합집합이 되지 않는지 검증한다.
 *
 * <p>구성원 행을 잠그지 않으면 두 트랜잭션의 삭제가 각각 0건이 되어 양쪽 삽입이 모두 남는다. 그
 * 결과 최대 20개가 남아 0~10개 전체 교체 계약을 깨고, 겹치는 문자열은 유니크 제약 위반으로 계약에
 * 없는 오류가 된다.
 *
 * <p>클래스에 {@code @Transactional}을 붙이지 않는 이유는 준비 데이터가 커밋되어야 다른 스레드에서
 * 보이고, 요청이 테스트 트랜잭션에 합류하면 경쟁이 재현되지 않기 때문이다.
 */
@AutoConfigureMockMvc
class MemberInterestReplaceConcurrencyTest extends IntegrationTest {

	private static final int ATTEMPTS = 20;
	private static final long REQUEST_TIMEOUT_SECONDS = 5;
	private static final int MAX_INTERESTS = 10;
	private static final String INVITE_CODE = "MIC123";
	private static final String MANAGER_LOGIN_ID = "mic_manager";
	private static final String CARE_RECEIVER_LOGIN_ID = "mic_target";
	private static final List<String> LOGIN_IDS = List.of(MANAGER_LOGIN_ID, CARE_RECEIVER_LOGIN_ID);

	private static final List<String> FIRST_INTERESTS = interests("가");
	private static final List<String> SECOND_INTERESTS = interests("나");

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

	private Long groupId;
	private Long careReceiverMemberId;
	private Long careReceiverUserId;

	@BeforeEach
	void setUp() {
		clearOwnData();
		transactionTemplate.executeWithoutResult(status -> {
			User manager = userRepository.save(user(MANAGER_LOGIN_ID, "관리자"));
			User careReceiver = userRepository.save(user(CARE_RECEIVER_LOGIN_ID, "피보호자"));
			FamilyGroup group = familyGroupRepository.save(new FamilyGroup("우리가족", INVITE_CODE));
			groupMemberRepository.save(new GroupMember(group, manager, GroupRole.GUARDIAN, true, Instant.now()));
			GroupMember target = groupMemberRepository.save(
				new GroupMember(group, careReceiver, GroupRole.CARE_RECEIVER, false, Instant.now()));

			groupId = group.getId();
			careReceiverMemberId = target.getId();
			careReceiverUserId = careReceiver.getId();
		});
	}

	@AfterEach
	void tearDown() {
		clearOwnData();
	}

	@Test
	void concurrentReplacementsKeepExactlyOneRequestedList() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
				CountDownLatch start = new CountDownLatch(1);

				Future<Integer> first = executor.submit(replace(start, FIRST_INTERESTS));
				Future<Integer> second = executor.submit(replace(start, SECOND_INTERESTS));
				start.countDown();

				int firstStatus = first.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
				int secondStatus = second.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);

				assertThat(List.of(firstStatus, secondStatus))
					.as("%d번째 시도: 직렬화되면 두 요청 모두 성공해야 한다", attempt)
					.containsExactly(200, 200);
				assertStoredListIsOneOfRequests(attempt);

				discardAttempt();
			}
		} finally {
			shutDown(executor);
		}
	}

	/**
	 * 저장된 관심사는 두 요청 목록 중 하나와 정확히 같아야 한다. 합집합이 남으면 개수부터 어긋난다.
	 */
	private void assertStoredListIsOneOfRequests(int attempt) {
		transactionTemplate.executeWithoutResult(status -> {
			@SuppressWarnings("unchecked")
			List<String> stored = entityManager.createNativeQuery("""
					select interest_text
					from member_interests
					where care_receiver_member_id = :memberId
					order by id
					""")
				.setParameter("memberId", careReceiverMemberId)
				.getResultList();

			assertThat(stored)
				.as("%d번째 시도: 두 목록의 합집합이 남았다", attempt)
				.hasSize(MAX_INTERESTS);
			assertThat(stored)
				.as("%d번째 시도: 저장된 목록이 두 요청 중 어느 쪽과도 일치하지 않는다", attempt)
				.isIn(FIRST_INTERESTS, SECOND_INTERESTS);
		});
	}

	/**
	 * 남은 요청 스레드가 끝날 때까지 기다린다. 잠금 회귀로 요청이 멈추면 그 트랜잭션이 구성원 행을
	 * 계속 쥐고 있어, 기다리지 않으면 뒤따르는 정리 삭제가 그 잠금을 기다리게 된다. 여기서 단정하지
	 * 않는 것은 본문의 실패 원인을 가리지 않기 위해서다.
	 */
	private void shutDown(ExecutorService executor) throws InterruptedException {
		executor.shutdownNow();
		executor.awaitTermination(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
	}

	private Callable<Integer> replace(CountDownLatch start, List<String> requested) {
		String body = requested.stream()
			.map(interest -> "\"" + interest + "\"")
			.reduce((left, right) -> left + ", " + right)
			.map(joined -> "{\"interests\": [" + joined + "]}")
			.orElse("{\"interests\": []}");
		return () -> {
			start.await();
			return mockMvc.perform(
					put("/groups/" + groupId + "/members/" + careReceiverMemberId + "/interests")
						.with(authenticatedAs(careReceiverUserId))
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andReturn()
				.getResponse()
				.getStatus();
		};
	}

	private void discardAttempt() {
		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
			entityManager.createNativeQuery(
					"DELETE FROM member_interests WHERE care_receiver_member_id = :memberId")
				.setParameter("memberId", careReceiverMemberId)
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
					DELETE FROM member_interests
					WHERE care_receiver_member_id IN (
						SELECT id FROM group_members
						WHERE group_id IN (SELECT id FROM family_groups WHERE invite_code = :inviteCode))
					""")
				.setParameter("inviteCode", INVITE_CODE)
				.executeUpdate();
			deleteByOwnGroup("DELETE FROM notifications");
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

	/**
	 * 두 목록이 한 글자도 겹치지 않아야 합집합과 전체 교체를 구분할 수 있다.
	 */
	private static List<String> interests(String marker) {
		return IntStream.rangeClosed(1, MAX_INTERESTS)
			.mapToObj(index -> marker + "취미" + index)
			.toList();
	}
}
