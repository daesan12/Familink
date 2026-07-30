package com.ssafy.s15p11b104.domain.group;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 같은 관리자가 서로 다른 대상에게 동시에 관리자 권한을 위임할 때의 정합성을 검증한다.
 *
 * <p>{@code uq_group_active_manager}는 그룹당 활성 관리자를 한 명으로 제한한다. 요청자 행을
 * 잠그지 않으면 두 트랜잭션이 같은 현재 관리자를 읽고 각자 다른 대상을 승격시켜, 활성 관리자가
 * 두 명이 되거나 유니크 위반으로 두 요청이 모두 실패할 수 있다.
 *
 * <p>{@code GroupMemberApiTest}와 달리 클래스에 {@code @Transactional}을 붙이지 않는다. 테스트
 * 트랜잭션 안에서는 준비한 데이터가 커밋되지 않아 다른 스레드에서 보이지 않고, 요청도 테스트
 * 트랜잭션에 합류해 경쟁 자체가 재현되지 않는다. 대신 준비와 검증을 각각 커밋되는 트랜잭션으로
 * 나누고 정리는 직접 수행한다.
 */
@AutoConfigureMockMvc
class ManagerTransferConcurrencyTest extends IntegrationTest {

	private static final int ATTEMPTS = 10;
	private static final long TRANSFER_TIMEOUT_SECONDS = 5;
	private static final String INVITE_CODE = "MGR123";
	private static final String MANAGER_LOGIN_ID = "mgr_manager";
	private static final String FIRST_CANDIDATE_LOGIN_ID = "mgr_first";
	private static final String SECOND_CANDIDATE_LOGIN_ID = "mgr_second";

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
	private Long managerUserId;
	private Long managerMemberId;
	private Long firstCandidateUserId;
	private Long firstCandidateMemberId;
	private Long secondCandidateMemberId;

	@BeforeEach
	void setUp() {
		clearOwnData();
		transactionTemplate.executeWithoutResult(status -> {
			User manager = userRepository.save(user(MANAGER_LOGIN_ID, "관리자"));
			User first = userRepository.save(user(FIRST_CANDIDATE_LOGIN_ID, "후보1"));
			User second = userRepository.save(user(SECOND_CANDIDATE_LOGIN_ID, "후보2"));
			FamilyGroup group = familyGroupRepository.save(new FamilyGroup("우리가족", INVITE_CODE));

			groupId = group.getId();
			managerUserId = manager.getId();
			firstCandidateUserId = first.getId();
			managerMemberId = groupMemberRepository
				.save(new GroupMember(group, manager, GroupRole.GUARDIAN, true, Instant.now()))
				.getId();
			firstCandidateMemberId = groupMemberRepository
				.save(new GroupMember(group, first, GroupRole.GUARDIAN, false, Instant.now()))
				.getId();
			secondCandidateMemberId = groupMemberRepository
				.save(new GroupMember(group, second, GroupRole.GUARDIAN, false, Instant.now()))
				.getId();
		});
	}

	@AfterEach
	void tearDown() {
		clearOwnData();
	}

	@Test
	void concurrentTransfersKeepExactlyOneActiveManager() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
				CountDownLatch start = new CountDownLatch(1);

				Future<Integer> toFirst = executor.submit(transfer(start, firstCandidateMemberId));
				Future<Integer> toSecond = executor.submit(transfer(start, secondCandidateMemberId));
				start.countDown();

				int firstStatus = toFirst.get(TRANSFER_TIMEOUT_SECONDS, TimeUnit.SECONDS);
				int secondStatus = toSecond.get(TRANSFER_TIMEOUT_SECONDS, TimeUnit.SECONDS);

				assertThat(List.of(firstStatus, secondStatus))
					.as("%d번째 시도: 먼저 위임한 요청만 성공하고 나머지는 권한을 잃어야 한다", attempt)
					.containsExactlyInAnyOrder(200, 403);
				assertSingleActiveManager(attempt);

				restoreOriginalState();
			}
		} finally {
			shutDown(executor);
		}
	}

	/**
	 * 위임과 승격 대상의 그룹 탈퇴가 겹쳐도 활성 관리자가 사라지지 않아야 한다.
	 *
	 * <p>대상 행을 잠그지 않으면 두 트랜잭션이 서로의 변경을 덮어쓴다. 위임이 나중에 커밋되면
	 * 이미 떠난 구성원이 관리자로 되살아나고, 탈퇴가 나중에 커밋되면 승격된 관리자에게
	 * {@code left_at}이 기록되어 활성 관리자가 0명이 된다. 후자는 모든 관리자 API가 403이 되어
	 * API로 복구할 수 없다.
	 */
	@Test
	void concurrentTransferAndTargetLeaveKeepExactlyOneActiveManager() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
				CountDownLatch start = new CountDownLatch(1);

				Future<Integer> transfer = executor.submit(transfer(start, firstCandidateMemberId));
				Future<Integer> leave = executor.submit(leave(start, firstCandidateUserId));
				start.countDown();

				int transferStatus = transfer.get(TRANSFER_TIMEOUT_SECONDS, TimeUnit.SECONDS);
				int leaveStatus = leave.get(TRANSFER_TIMEOUT_SECONDS, TimeUnit.SECONDS);

				boolean transferWon = transferStatus == 200;
				boolean leaveWon = leaveStatus == 204;
				assertThat(transferWon ^ leaveWon)
					.as("%d번째 시도: 위임(%d)과 탈퇴(%d) 중 정확히 하나만 성공해야 한다",
						attempt, transferStatus, leaveStatus)
					.isTrue();
				assertThat(transferWon ? leaveStatus : transferStatus)
					.as("%d번째 시도: 실패한 요청은 409로 거부되어야 한다", attempt)
					.isEqualTo(409);
				assertActiveManagerSurvives(attempt, transferWon);

				restoreOriginalState();
			}
		} finally {
			shutDown(executor);
		}
	}

	/**
	 * 남은 요청 스레드가 끝날 때까지 기다린다. 잠금 회귀로 요청이 멈추면 그 트랜잭션이 멤버십 행을
	 * 계속 쥐고 있어, 기다리지 않으면 뒤따르는 정리 삭제가 그 잠금을 기다리게 된다.
	 */
	private void shutDown(ExecutorService executor) throws InterruptedException {
		executor.shutdownNow();
		executor.awaitTermination(TRANSFER_TIMEOUT_SECONDS, TimeUnit.SECONDS);
	}

	private Callable<Integer> transfer(CountDownLatch start, Long newManagerMemberId) {
		return () -> {
			start.await();
			return mockMvc.perform(patch("/groups/" + groupId + "/manager")
					.with(authenticatedAs(managerUserId))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"newManagerMemberId\": " + newManagerMemberId + "}"))
				.andReturn()
				.getResponse()
				.getStatus();
		};
	}

	private Callable<Integer> leave(CountDownLatch start, Long userId) {
		return () -> {
			start.await();
			return mockMvc.perform(delete("/groups/" + groupId + "/leave")
					.with(authenticatedAs(userId)))
				.andReturn()
				.getResponse()
				.getStatus();
		};
	}

	/**
	 * 위임이 이겼으면 대상이 활성 관리자로 남고, 탈퇴가 이겼으면 원래 관리자가 그대로 남아야 한다.
	 * 어느 경우에도 활성 관리자는 정확히 한 명이다.
	 */
	private void assertActiveManagerSurvives(int attempt, boolean transferWon) {
		transactionTemplate.executeWithoutResult(status -> {
			List<GroupMember> activeManagers = groupMemberRepository.findAllActiveByGroupId(groupId).stream()
				.filter(GroupMember::isManager)
				.toList();

			assertThat(activeManagers)
				.as("%d번째 시도: 활성 관리자가 없는 그룹이 남았다", attempt)
				.hasSize(1);
			assertThat(activeManagers.getFirst().getId())
				.as("%d번째 시도: 위임 성공 여부(%s)와 최종 관리자가 어긋난다", attempt, transferWon)
				.isEqualTo(transferWon ? firstCandidateMemberId : managerMemberId);
		});
	}

	private void assertSingleActiveManager(int attempt) {
		transactionTemplate.executeWithoutResult(status -> {
			List<Long> managerIds = groupMemberRepository.findAllActiveByGroupId(groupId).stream()
				.filter(GroupMember::isManager)
				.map(GroupMember::getId)
				.toList();

			assertThat(managerIds)
				.as("%d번째 시도: 활성 관리자는 정확히 한 명이어야 한다", attempt)
				.hasSize(1);
			assertThat(managerIds.getFirst())
				.as("%d번째 시도: 위임 대상 중 한 명이 관리자여야 한다", attempt)
				.isIn(firstCandidateMemberId, secondCandidateMemberId);
		});
	}

	/**
	 * 다음 시도를 위해 원래 관리자와 활성 상태로 되돌린다. 유니크 인덱스를 위반하지 않도록 관리자
	 * 해제를 먼저 커밋한다.
	 */
	private void restoreOriginalState() {
		transactionTemplate.executeWithoutResult(status -> entityManager.createQuery("""
			update GroupMember member
			set member.manager = false, member.leftAt = null
			where member.group.id = :groupId
			""")
			.setParameter("groupId", groupId)
			.executeUpdate());
		transactionTemplate.executeWithoutResult(status -> entityManager.createQuery("""
			update GroupMember member
			set member.manager = true
			where member.id = :memberId
			""")
			.setParameter("memberId", managerMemberId)
			.executeUpdate());
	}

	/**
	 * 이 클래스가 만든 행만 지운다. 커밋하는 테스트라 롤백으로 정리되지 않고, 전체 삭제는 다른
	 * 테스트가 남긴 행의 외래 키를 건드릴 수 있다.
	 */
	private void clearOwnData() {
		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
			entityManager.createNativeQuery("DELETE FROM group_members"
					+ " WHERE group_id IN (SELECT id FROM family_groups WHERE invite_code = :inviteCode)")
				.setParameter("inviteCode", INVITE_CODE)
				.executeUpdate();
			entityManager.createNativeQuery("DELETE FROM family_groups WHERE invite_code = :inviteCode")
				.setParameter("inviteCode", INVITE_CODE)
				.executeUpdate();
			entityManager.createNativeQuery("DELETE FROM users WHERE login_id in (:loginIds)")
				.setParameter("loginIds", List.of(
					MANAGER_LOGIN_ID, FIRST_CANDIDATE_LOGIN_ID, SECOND_CANDIDATE_LOGIN_ID))
				.executeUpdate();
		});
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		AuthenticatedUser principal = new AuthenticatedUser(userId, "test-access-token");
		return authentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1960, 5, 2), UserGender.FEMALE);
	}
}
