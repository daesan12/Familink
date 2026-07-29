package com.ssafy.s15p11b104.domain.carnation;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
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
	private CarnationRepository carnationRepository;

	private FamilyGroup group;
	private GroupMember firstGuardian;
	private GroupMember secondGuardian;
	private GroupMember careReceiver;
	private User outsider;
	private LocalDate weekStart;

	@BeforeEach
	void setUp() {
		carnationRepository.deleteAll();
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

		carnationRepository.saveAll(List.of(
			new Carnation(group, firstGuardian, weekStart),
			new Carnation(group, firstGuardian, weekStart.plusDays(1)),
			new Carnation(group, secondGuardian, weekStart),
			new Carnation(group, secondGuardian, weekStart.plusDays(1)),
			new Carnation(group, firstGuardian, weekStart.minusDays(1))));
		entityManager.flush();
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
			.andExpect(jsonPath("$.data.rankings.length()").value(2))
			.andExpect(jsonPath("$.data.rankings[0].rank").value(1))
			.andExpect(jsonPath("$.data.rankings[1].rank").value(1))
			.andExpect(jsonPath("$.data.rankings[0].carnationCount").value(2))
			.andExpect(jsonPath("$.data.rankings[1].carnationCount").value(2))
			.andExpect(jsonPath("$.data.rankings[0].previousWeekWinner").value(true))
			.andExpect(jsonPath("$.data.rankings[1].previousWeekWinner").value(false))
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

	private RequestPostProcessor authenticatedAs(Long userId) {
		return authentication(new UsernamePasswordAuthenticationToken(
			new AuthenticatedUser(userId, "test-access-token"), null, List.of()));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1995, 3, 17), UserGender.MALE);
	}
}
