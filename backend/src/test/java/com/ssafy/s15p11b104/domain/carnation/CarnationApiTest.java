package com.ssafy.s15p11b104.domain.carnation;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.carnation.entity.Carnation;
import com.ssafy.s15p11b104.domain.carnation.repository.CarnationRepository;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.repository.PostMediaRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.group.entity.MemberAlias;
import com.ssafy.s15p11b104.domain.group.repository.MemberAliasRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

@AutoConfigureMockMvc
@Transactional
class CarnationApiTest extends IntegrationTest {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private GroupMemberRepository groupMemberRepository;

	@Autowired
	private MemberAliasRepository memberAliasRepository;

	@Autowired
	private CarnationRepository carnationRepository;

	@Autowired
	private PostRepository postRepository;

	@Autowired
	private PostMediaRepository postMediaRepository;

	private FamilyGroup group;
	private GroupMember firstGuardian;
	private GroupMember secondGuardian;
	private GroupMember careReceiver;
	private User outsider;
	private LocalDate weekStart;

	@BeforeEach
	void setUp() {
		carnationRepository.deleteAll();
		postMediaRepository.deleteAll();
		postRepository.deleteAll();
		groupMemberRepository.deleteAll();
		entityManager.createQuery("delete from FamilyGroup").executeUpdate();
		userRepository.deleteAll();
		entityManager.flush();

		User firstUser = userRepository.save(user("carn_first", "첫 보호자"));
		User secondUser = userRepository.save(user("carn_second", "둘째 보호자"));
		User receiverUser = userRepository.save(user("carn_recv", "피보호자"));
		outsider = userRepository.save(user("carn_out", "외부인"));
		group = entityManager.merge(new FamilyGroup("카네이션 가족", "GRS135"));
		entityManager.flush();

		firstGuardian = groupMemberRepository.save(
			new GroupMember(group, firstUser, GroupRole.GUARDIAN, true, Instant.now()));
		secondGuardian = groupMemberRepository.save(
			new GroupMember(group, secondUser, GroupRole.GUARDIAN, false, Instant.now()));
		careReceiver = groupMemberRepository.save(
			new GroupMember(group, receiverUser, GroupRole.CARE_RECEIVER, false, Instant.now()));
		entityManager.flush();
		weekStart = LocalDate.now(BUSINESS_ZONE).with(DayOfWeek.MONDAY);

		// 잔디(카네이션)는 여전히 날짜 단위 적립이다. 달력 조회 테스트가 이 데이터를 쓴다.
		carnationRepository.saveAll(List.of(
			new Carnation(group, firstGuardian, weekStart),
			new Carnation(group, firstGuardian, weekStart.plusDays(1)),
			new Carnation(group, secondGuardian, weekStart),
			new Carnation(group, secondGuardian, weekStart.plusDays(1)),
			new Carnation(group, firstGuardian, weekStart.minusDays(1))));
		entityManager.flush();

		// 랭킹은 게시글 건수로 집계한다. 두 보호자의 이번 주 건수를 2:2로 맞추되
		// 첫 보호자는 하루에 몰아서, 둘째 보호자는 이틀에 나눠 작성한다.
		// 날짜 수 기준이던 예전 규칙이라면 1:2가 되어 동점이 깨진다.
		savePostAt(firstGuardian, kst(weekStart, 9));
		savePostAt(firstGuardian, kst(weekStart, 21));
		savePostAt(secondGuardian, kst(weekStart, 10));
		savePostAt(secondGuardian, kst(weekStart.plusDays(1), 10));
		// 지난주에는 첫 보호자만 작성했으므로 왕관은 첫 보호자가 받는다.
		savePostAt(firstGuardian, kst(weekStart.minusDays(1), 12));
		// 피보호자 게시글은 랭킹에 잡히면 안 된다.
		savePostAt(careReceiver, kst(weekStart, 11));
	}

	@Test
	void activeMemberCanReadCarnationCalendar() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/members/{memberId}/carnations", group.getId(), firstGuardian.getId())
				.param("startDate", weekStart.toString())
				.param("endDate", weekStart.plusDays(6).toString())
				.with(authenticatedAs(careReceiver.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.memberId").value(firstGuardian.getId()))
			.andExpect(jsonPath("$.data.startDate").value(weekStart.toString()))
			.andExpect(jsonPath("$.data.endDate").value(weekStart.plusDays(6).toString()))
			.andExpect(jsonPath("$.data.earnedDates").isArray())
			.andExpect(jsonPath("$.data.earnedDates.length()").value(2));
	}

	@Test
	void grassReturnsGuardianRankingWithTieAndPreviousWinner() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/grass", group.getId())
				.param("startDate", weekStart.toString())
				.param("endDate", weekStart.plusDays(6).toString())
				.with(authenticatedAs(careReceiver.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.weekStart").value(weekStart.toString()))
			.andExpect(jsonPath("$.data.weekEnd").value(weekStart.plusDays(6).toString()))
			// 피보호자는 보호자만 오르는 랭킹에서 제외된다.
			.andExpect(jsonPath("$.data.rankings.length()").value(2))
			.andExpect(jsonPath("$.data.rankings[0].rank").value(1))
			.andExpect(jsonPath("$.data.rankings[1].rank").value(1))
			.andExpect(jsonPath("$.data.rankings[0].postCount").value(2))
			.andExpect(jsonPath("$.data.rankings[1].postCount").value(2))
			.andExpect(jsonPath("$.data.rankings[0].previousWeekWinner").value(true))
			.andExpect(jsonPath("$.data.rankings[1].previousWeekWinner").value(false))
			.andExpect(jsonPath("$.data.rankings[0].displayName").value("첫 보호자"));
	}

	@Test
	void sameDayPostsRaiseRankingScore() throws Exception {
		// 첫 보호자가 같은 월요일에 세 번째 글을 쓴다. 여전히 하루지만 건수는 3이 된다.
		// 날짜 수 기준이던 예전 규칙이라면 1점에 머물러 둘째 보호자(2일)에게 밀렸을 상황이다.
		savePostAt(firstGuardian, kst(weekStart, 22));

		mockMvc.perform(get("/groups/{groupId}/grass", group.getId())
				.param("startDate", weekStart.toString())
				.param("endDate", weekStart.plusDays(6).toString())
				.with(authenticatedAs(careReceiver.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.rankings[0].displayName").value("첫 보호자"))
			.andExpect(jsonPath("$.data.rankings[0].rank").value(1))
			.andExpect(jsonPath("$.data.rankings[0].postCount").value(3))
			.andExpect(jsonPath("$.data.rankings[1].displayName").value("둘째 보호자"))
			.andExpect(jsonPath("$.data.rankings[1].rank").value(2))
			.andExpect(jsonPath("$.data.rankings[1].postCount").value(2));
	}

	@Test
	void weekBoundaryFollowsKstNotUtc() throws Exception {
		// 경계 게시글을 두 보호자에게 나눠 배치한다. 한쪽에 몰면 KST를 UTC로 잘못 자른
		// 구현에서 "빠져야 할 건이 들어오고 들어와야 할 건이 빠지는" 오차가 서로 상쇄되어
		// 합계가 같아지고 테스트가 통과해 버린다.

		// 월요일 08:00 KST = 일요일 23:00 UTC. UTC로 잘랐다면 이번 주에서 빠진다.
		savePostAt(secondGuardian, kst(weekStart, 8));
		// 이번 주 마지막 순간(일요일 23:00 KST)은 이번 주에 포함된다.
		savePostAt(secondGuardian, kst(weekStart.plusDays(6), 23));
		// 직전 주 일요일 23:00 KST는 이번 주가 아니다.
		savePostAt(secondGuardian, kst(weekStart.minusDays(1), 23));
		// 다음 주 월요일 00:00 KST = 일요일 15:00 UTC. UTC로 잘랐다면 이번 주에 잘못 들어온다.
		savePostAt(firstGuardian, kst(weekStart.plusDays(7), 0));

		mockMvc.perform(get("/groups/{groupId}/grass", group.getId())
				.param("startDate", weekStart.toString())
				.param("endDate", weekStart.plusDays(6).toString())
				.with(authenticatedAs(careReceiver.getUser().getId())))
			.andExpect(status().isOk())
			// KST 기준이면 둘째 4건(기존 2 + 경계 안쪽 2), 첫째 2건(기존 2)이다.
			// UTC로 잘랐다면 둘째 3건, 첫째 3건이 되어 동점으로 무너진다.
			.andExpect(jsonPath("$.data.rankings[0].displayName").value("둘째 보호자"))
			.andExpect(jsonPath("$.data.rankings[0].rank").value(1))
			.andExpect(jsonPath("$.data.rankings[0].postCount").value(4))
			.andExpect(jsonPath("$.data.rankings[1].displayName").value("첫 보호자"))
			.andExpect(jsonPath("$.data.rankings[1].rank").value(2))
			.andExpect(jsonPath("$.data.rankings[1].postCount").value(2));
	}

	@Test
	void deletedPostNoLongerCountsTowardRanking() throws Exception {
		// 게시글은 하드 삭제이고 랭킹은 남아 있는 글만 센다. 잔디와 달리 점수가 줄어든다.
		// 나중에 소프트 삭제를 도입하면서 집계 쿼리에 필터를 넣지 않으면 이 테스트가 잡는다.
		Long extraPostId = savePostAt(firstGuardian, kst(weekStart, 23));

		mockMvc.perform(get("/groups/{groupId}/grass", group.getId())
				.param("startDate", weekStart.toString())
				.param("endDate", weekStart.plusDays(6).toString())
				.with(authenticatedAs(careReceiver.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.rankings[0].displayName").value("첫 보호자"))
			.andExpect(jsonPath("$.data.rankings[0].postCount").value(3));

		postRepository.deleteById(extraPostId);
		entityManager.flush();

		mockMvc.perform(get("/groups/{groupId}/grass", group.getId())
				.param("startDate", weekStart.toString())
				.param("endDate", weekStart.plusDays(6).toString())
				.with(authenticatedAs(careReceiver.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.rankings[0].postCount").value(2))
			.andExpect(jsonPath("$.data.rankings[1].postCount").value(2));
	}

	@Test
	void previousWeekWinnerUsesPostCount() throws Exception {
		// 지난주 같은 날 2건. 날짜 수 기준이라면 첫 보호자와 1:1 동점이라 둘 다 왕관을 받았다.
		savePostAt(secondGuardian, kst(weekStart.minusDays(2), 10));
		savePostAt(secondGuardian, kst(weekStart.minusDays(2), 11));

		mockMvc.perform(get("/groups/{groupId}/grass", group.getId())
				.param("startDate", weekStart.toString())
				.param("endDate", weekStart.plusDays(6).toString())
				.with(authenticatedAs(careReceiver.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.rankings[0].displayName").value("첫 보호자"))
			.andExpect(jsonPath("$.data.rankings[0].previousWeekWinner").value(false))
			.andExpect(jsonPath("$.data.rankings[1].displayName").value("둘째 보호자"))
			.andExpect(jsonPath("$.data.rankings[1].previousWeekWinner").value(true));
	}

	@Test
	void grassUsesViewerSpecificAliasAndFallsBackToRealNameForOtherViewer() throws Exception {
		memberAliasRepository.save(new MemberAlias(group, careReceiver, firstGuardian, "우리 아빠"));
		entityManager.flush();

		mockMvc.perform(get("/groups/{groupId}/grass", group.getId())
				.with(authenticatedAs(careReceiver.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.rankings[0].displayName").value("우리 아빠"));

		mockMvc.perform(get("/groups/{groupId}/grass", group.getId())
				.with(authenticatedAs(firstGuardian.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.rankings[0].displayName").value("첫 보호자"));
	}

	@Test
	void outsiderCannotReadCarnationData() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/grass", group.getId())
				.with(authenticatedAs(outsider.getId())))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void unauthenticatedRequestIsRejected() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/grass", group.getId()))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void invalidCalendarRangeIsRejected() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/members/{memberId}/carnations", group.getId(), firstGuardian.getId())
				.param("startDate", weekStart.plusDays(2).toString())
				.param("endDate", weekStart.toString())
				.with(authenticatedAs(firstGuardian.getUser().getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void grassRejectsNonWeeklyDateRange() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/grass", group.getId())
				.param("startDate", weekStart.plusDays(1).toString())
				.param("endDate", weekStart.plusDays(7).toString())
				.with(authenticatedAs(firstGuardian.getUser().getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	private Instant kst(LocalDate date, int hour) {
		return date.atTime(hour, 0).atZone(BUSINESS_ZONE).toInstant();
	}

	/**
	 * 지정한 시각에 작성된 게시글을 만든다.
	 *
	 * <p>{@code created_at}은 {@code @PrePersist}가 채우고 {@code updatable = false}라 JPA로는 원하는
	 * 시각을 넣을 수 없다. 저장 후 native update로 덮어쓴다.
	 *
	 * @return 만들어진 게시글 ID
	 */
	private Long savePostAt(GroupMember author, Instant createdAt) {
		Post post = postRepository.save(new Post(group, author, "글"));
		entityManager.flush();
		entityManager.createNativeQuery("update posts set created_at = :createdAt where id = :id")
			.setParameter("createdAt", OffsetDateTime.ofInstant(createdAt, ZoneOffset.UTC))
			.setParameter("id", post.getId())
			.executeUpdate();
		entityManager.flush();
		return post.getId();
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		return authentication(new UsernamePasswordAuthenticationToken(
			new AuthenticatedUser(userId, "test-access-token"), null, List.of()));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1995, 3, 17), UserGender.MALE);
	}
}
