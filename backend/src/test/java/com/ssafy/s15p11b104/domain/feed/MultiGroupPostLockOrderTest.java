package com.ssafy.s15p11b104.domain.feed;

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
 * 여러 그룹에 한 번에 게시글을 만드는 요청이 회원 탈퇴와 같은 순서로 멤버십 행을 잠그는지 검증한다.
 *
 * <p>두 경로 모두 같은 사용자의 여러 멤버십 행을 잠근다. 정렬 기준이 다르면 서로 반대 순서로 대기해
 * PostgreSQL이 교착을 감지하고 계약에 없는 500이 된다. 그래서 두 경로 모두 {@code group_members.id}
 * 오름차순으로 잠근다.
 *
 * <p>픽스처는 <b>{@code group_id} 오름차순과 {@code group_members.id} 오름차순이 역전되도록</b> 만든다.
 * 먼저 만든 그룹에 나중에 가입시키면 된다. 게시글 생성이 요청의 {@code groupId} 순으로 잠그면 이
 * 배치에서 순서가 어긋나 교착한다.
 *
 * <p>교착을 확실히 만들기 위해 탈퇴 쪽 순서를 흉내낸 트랜잭션이 낮은 id 행만 먼저 잠그고 기다린 뒤
 * 높은 id 행을 요구한다. 그 사이 게시글 요청이 높은 id 행을 잡으면 순환이 완성된다.
 *
 * <p>클래스에 {@code @Transactional}을 붙이지 않는 이유는 준비 데이터가 커밋되어야 다른 스레드에서
 * 보이고, 요청이 테스트 트랜잭션에 합류하면 잠금 경쟁이 재현되지 않기 때문이다.
 */
@AutoConfigureMockMvc
class MultiGroupPostLockOrderTest extends IntegrationTest {

	private static final long HANDOFF_SECONDS = 1;
	private static final long REQUEST_TIMEOUT_SECONDS = 15;
	private static final String FIRST_INVITE_CODE = "MGL001";
	private static final String SECOND_INVITE_CODE = "MGL002";
	private static final List<String> INVITE_CODES = List.of(FIRST_INVITE_CODE, SECOND_INVITE_CODE);
	private static final String WRITER_LOGIN_ID = "mgl_writer";
	private static final String FIRST_MANAGER_LOGIN_ID = "mgl_manager1";
	private static final String SECOND_MANAGER_LOGIN_ID = "mgl_manager2";
	private static final List<String> LOGIN_IDS =
		List.of(WRITER_LOGIN_ID, FIRST_MANAGER_LOGIN_ID, SECOND_MANAGER_LOGIN_ID);

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

	private Long writerUserId;
	private Long lowerMemberId;
	private Long higherMemberId;
	private List<Long> groupIdsInAscendingOrder;

	/**
	 * {@code group_id} 오름차순과 {@code group_members.id} 오름차순이 역전된 배치를 만든다. 두 그룹을
	 * 먼저 만들고 작성자를 두 번째 그룹부터 가입시킨다.
	 */
	@BeforeEach
	void setUp() {
		clearOwnData();
		transactionTemplate.executeWithoutResult(status -> {
			User writer = userRepository.save(user(WRITER_LOGIN_ID, "작성자"));
			User firstManager = userRepository.save(user(FIRST_MANAGER_LOGIN_ID, "관리자1"));
			User secondManager = userRepository.save(user(SECOND_MANAGER_LOGIN_ID, "관리자2"));
			FamilyGroup firstGroup = familyGroupRepository.save(new FamilyGroup("첫째가족", FIRST_INVITE_CODE));
			FamilyGroup secondGroup = familyGroupRepository.save(new FamilyGroup("둘째가족", SECOND_INVITE_CODE));

			groupMemberRepository.save(
				new GroupMember(firstGroup, firstManager, GroupRole.GUARDIAN, true, Instant.now()));
			groupMemberRepository.save(
				new GroupMember(secondGroup, secondManager, GroupRole.GUARDIAN, true, Instant.now()));
			GroupMember inSecondGroup = groupMemberRepository.save(
				new GroupMember(secondGroup, writer, GroupRole.GUARDIAN, false, Instant.now()));
			GroupMember inFirstGroup = groupMemberRepository.save(
				new GroupMember(firstGroup, writer, GroupRole.GUARDIAN, false, Instant.now()));

			writerUserId = writer.getId();
			lowerMemberId = inSecondGroup.getId();
			higherMemberId = inFirstGroup.getId();
			groupIdsInAscendingOrder = List.of(firstGroup.getId(), secondGroup.getId());
		});
	}

	@AfterEach
	void tearDown() {
		clearOwnData();
	}

	@Test
	void multiGroupPostCreationLocksMembershipsInTheSameOrderAsWithdrawal() throws Exception {
		assertThat(lowerMemberId)
			.as("픽스처 전제가 깨졌다. 낮은 멤버십 id가 높은 groupId에 속해야 순서 역전이 만들어진다")
			.isLessThan(higherMemberId);
		assertThat(groupIdsInAscendingOrder)
			.as("픽스처 전제가 깨졌다. 요청은 groupId 오름차순이어야 순서 역전이 드러난다")
			.isSorted();

		ExecutorService executor = Executors.newFixedThreadPool(2);
		CountDownLatch lowerLocked = new CountDownLatch(1);
		AtomicInteger responseStatus = new AtomicInteger();

		try {
			Future<?> withdrawalOrderHolder = executor.submit(
				() -> transactionTemplate.executeWithoutResult(status -> {
					groupMemberRepository.findByIdForUpdate(lowerMemberId).orElseThrow();
					lowerLocked.countDown();
					sleepQuietly(HANDOFF_SECONDS);
					groupMemberRepository.findByIdForUpdate(higherMemberId).orElseThrow();
				}));

			Future<?> writer = executor.submit(() -> {
				if (!awaitQuietly(lowerLocked)) {
					throw new IllegalStateException("멤버십 잠금 신호를 기다리는 시간이 초과되었습니다.");
				}
				responseStatus.set(createPostsInAscendingGroupIdOrder());
			});

			writer.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
			withdrawalOrderHolder.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);

			assertThat(responseStatus.get())
				.as("게시글 생성이 탈퇴와 반대 순서로 잠가 교착했다. 정렬 기준이 group_members.id인지 확인한다")
				.isEqualTo(201);
		} finally {
			executor.shutdownNow();
			executor.awaitTermination(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
		}
	}

	private int createPostsInAscendingGroupIdOrder() {
		String body = """
			{
				"groupIds": [%d, %d],
				"content": "여러 그룹 동시 작성",
				"media": []
			}
			""".formatted(groupIdsInAscendingOrder.get(0), groupIdsInAscendingOrder.get(1));
		try {
			return mockMvc.perform(post("/posts")
					.with(authenticatedAs(writerUserId))
					.contentType(MediaType.APPLICATION_JSON)
					.content(body))
				.andReturn()
				.getResponse()
				.getStatus();
		} catch (Exception exception) {
			throw new IllegalStateException("게시글 생성 요청이 실패했습니다.", exception);
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

	/**
	 * 이 클래스가 만든 행만 지운다. 커밋하는 테스트라 롤백으로 정리되지 않고, 전체 삭제는 다른
	 * 테스트가 남긴 행의 외래 키를 건드릴 수 있다. 게시글의 자식 행은 스키마의
	 * {@code ON DELETE CASCADE}로 함께 지워진다.
	 */
	private void clearOwnData() {
		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
			deleteByOwnGroups("DELETE FROM notifications");
			deleteByOwnGroups("DELETE FROM posts");
			deleteByOwnGroups("DELETE FROM carnations");
			deleteByOwnGroups("DELETE FROM group_join_requests");
			deleteByOwnGroups("DELETE FROM group_members");
			entityManager.createNativeQuery("DELETE FROM family_groups WHERE invite_code in (:inviteCodes)")
				.setParameter("inviteCodes", INVITE_CODES)
				.executeUpdate();
			entityManager.createNativeQuery("DELETE FROM users WHERE login_id in (:loginIds)")
				.setParameter("loginIds", LOGIN_IDS)
				.executeUpdate();
		});
	}

	private void deleteByOwnGroups(String deleteClause) {
		entityManager.createNativeQuery(deleteClause
				+ " WHERE group_id IN (SELECT id FROM family_groups WHERE invite_code in (:inviteCodes))")
			.setParameter("inviteCodes", INVITE_CODES)
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
