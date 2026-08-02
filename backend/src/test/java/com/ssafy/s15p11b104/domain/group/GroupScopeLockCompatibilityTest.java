package com.ssafy.s15p11b104.domain.group;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupJoinRequest;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.entity.JoinRequestStatus;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupJoinRequestRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 그룹 범위 잠금이 그룹을 참조하는 쓰기를 막지 않는지 검증한다.
 *
 * <p>이 성질이 깨지면 교착이 돌아온다. PostgreSQL에서 외래 키 검사는 부모 행에
 * {@code FOR KEY SHARE}를 걸고, 이는 {@code FOR UPDATE}하고만 충돌한다. 그룹을 참조하는 쓰기는
 * 거의 모든 경로에 있고 대부분 자기 aggregate 행을 먼저 잠근 뒤 INSERT하므로, 그룹 삭제가 그룹
 * 행을 {@code FOR UPDATE}로 잡으면 두 경로의 잠금 순서가 정반대가 된다.
 *
 * <p>그래서 {@code lockForGroupScopeChange}는 {@code FOR NO KEY UPDATE}를 쓴다. 잠금 모드를
 * {@code FOR UPDATE}로 되돌리면 이 테스트의 참조 INSERT가 잠금 보유 중에 멈춰 실패한다.
 */
class GroupScopeLockCompatibilityTest extends IntegrationTest {

	private static final long LOCK_HOLD_TIMEOUT_SECONDS = 5;
	private static final long INSERT_TIMEOUT_SECONDS = 3;
	private static final String INVITE_CODE = "GSL123";
	private static final String MANAGER_LOGIN_ID = "gsl_manager";
	private static final String APPLICANT_LOGIN_ID = "gsl_applicant";
	private static final List<String> LOGIN_IDS = List.of(MANAGER_LOGIN_ID, APPLICANT_LOGIN_ID);

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
	void groupScopeLockDoesNotBlockWritesReferencingTheGroup() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		CountDownLatch locked = new CountDownLatch(1);
		CountDownLatch inserted = new CountDownLatch(1);
		AtomicBoolean insertedWhileLockHeld = new AtomicBoolean(false);

		try {
			Future<?> lockHolder = executor.submit(() -> transactionTemplate.executeWithoutResult(status -> {
				familyGroupRepository.lockForGroupScopeChange(groupId).orElseThrow();
				locked.countDown();
				insertedWhileLockHeld.set(awaitQuietly(inserted, INSERT_TIMEOUT_SECONDS));
			}));

			Future<?> referencingWriter = executor.submit(() -> {
				if (!awaitQuietly(locked, LOCK_HOLD_TIMEOUT_SECONDS)) {
					throw new IllegalStateException("그룹 잠금 신호를 기다리는 시간이 초과되었습니다.");
				}
				transactionTemplate.executeWithoutResult(status -> groupJoinRequestRepository.save(
					new GroupJoinRequest(
						familyGroupRepository.getReferenceById(groupId),
						userRepository.getReferenceById(applicantUserId),
						JoinRequestStatus.PENDING_ADMIN)));
				inserted.countDown();
			});

			referencingWriter.get(LOCK_HOLD_TIMEOUT_SECONDS + INSERT_TIMEOUT_SECONDS, TimeUnit.SECONDS);
			lockHolder.get(LOCK_HOLD_TIMEOUT_SECONDS + INSERT_TIMEOUT_SECONDS, TimeUnit.SECONDS);

			assertThat(insertedWhileLockHeld)
				.as("그룹 범위 잠금이 그룹을 참조하는 INSERT를 막았다. 잠금 모드가 FOR UPDATE로 되돌아갔는지 확인한다")
				.isTrue();
		} finally {
			inserted.countDown();
			executor.shutdownNow();
			executor.awaitTermination(LOCK_HOLD_TIMEOUT_SECONDS, TimeUnit.SECONDS);
		}
	}

	private boolean awaitQuietly(CountDownLatch latch, long timeoutSeconds) {
		try {
			return latch.await(timeoutSeconds, TimeUnit.SECONDS);
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			return false;
		}
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

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1960, 5, 2), UserGender.FEMALE);
	}
}
