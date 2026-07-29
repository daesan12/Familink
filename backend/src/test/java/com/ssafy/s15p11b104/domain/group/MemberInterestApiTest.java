package com.ssafy.s15p11b104.domain.group;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.entity.MemberInterest;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.group.repository.MemberInterestRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

@AutoConfigureMockMvc
@Transactional
class MemberInterestApiTest extends IntegrationTest {

	private static final String BASE_PATH = "/groups/%d/members/%d/interests";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private GroupMemberRepository groupMemberRepository;

	@Autowired
	private MemberInterestRepository memberInterestRepository;

	private FamilyGroup group;
	private GroupMember careReceiverMember;
	private GroupMember guardianMember;
	private GroupMember inactiveMember;
	private User outsider;

	@BeforeEach
	void setUp() {
		memberInterestRepository.deleteAll();
		groupMemberRepository.deleteAll();
		entityManager.createQuery("delete from FamilyGroup").executeUpdate();
		userRepository.deleteAll();
		entityManager.flush();

		User careReceiver = userRepository.save(user("care_receiver"));
		User guardian = userRepository.save(user("guardian_user"));
		outsider = userRepository.save(user("outsider_user"));
		User inactive = userRepository.save(user("inactive_user"));
		group = entityManager.merge(new FamilyGroup("family", "ABC123"));
		FamilyGroup otherGroup = entityManager.merge(new FamilyGroup("other", "XYZ789"));
		entityManager.flush();

		careReceiverMember = groupMemberRepository.save(
			new GroupMember(group, careReceiver, GroupRole.CARE_RECEIVER, false, Instant.now()));
		guardianMember = groupMemberRepository.save(
			new GroupMember(group, guardian, GroupRole.GUARDIAN, true, Instant.now()));
		inactiveMember = groupMemberRepository.save(
			new GroupMember(group, inactive, GroupRole.CARE_RECEIVER, false, Instant.now()));
		groupMemberRepository.save(
			new GroupMember(otherGroup, outsider, GroupRole.GUARDIAN, true, Instant.now()));
		entityManager.flush();
		entityManager.createQuery("""
			update GroupMember member
			set member.leftAt = :leftAt
			where member.id = :memberId
			""")
			.setParameter("leftAt", Instant.now())
			.setParameter("memberId", inactiveMember.getId())
			.executeUpdate();
		entityManager.clear();
	}

	@Test
	void careReceiverCanReplaceInterestsWithTrimmedDistinctValues() throws Exception {
		mockMvc.perform(put(path(careReceiverMember))
				.with(authenticatedAs(careReceiverMember.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("interests", List.of(" walk ", "walk", "music"))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.memberId").value(careReceiverMember.getId()))
			.andExpect(jsonPath("$.data.interests[0]").value("walk"))
			.andExpect(jsonPath("$.data.interests[1]").value("music"));

		List<MemberInterest> saved = memberInterestRepository
			.findAllByCareReceiverMemberIdOrderById(careReceiverMember.getId());
		Assertions.assertThat(saved)
			.extracting(MemberInterest::getInterestText)
			.containsExactly("walk", "music");
	}

	@Test
	void careReceiverCanReadOwnInterests() throws Exception {
		saveInterests("walk", "music");

		mockMvc.perform(get(path(careReceiverMember))
				.with(authenticatedAs(careReceiverMember.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.memberId").value(careReceiverMember.getId()))
			.andExpect(jsonPath("$.data.interests[0]").value("walk"))
			.andExpect(jsonPath("$.data.interests[1]").value("music"));
	}

	@Test
	void activeGuardianCanReadCareReceiverInterestsInSameGroup() throws Exception {
		saveInterests("music");

		mockMvc.perform(get(path(careReceiverMember))
				.with(authenticatedAs(guardianMember.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.interests[0]").value("music"));
	}

	@Test
	void outsiderCannotReadInterests() throws Exception {
		mockMvc.perform(get(path(careReceiverMember))
				.with(authenticatedAs(outsider.getId())))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void guardianCannotReplaceInterests() throws Exception {
		mockMvc.perform(put(path(careReceiverMember))
				.with(authenticatedAs(guardianMember.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("interests", List.of("walk"))))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void emptyListRemovesAllExistingInterests() throws Exception {
		saveInterests("walk", "music");

		mockMvc.perform(put(path(careReceiverMember))
				.with(authenticatedAs(careReceiverMember.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("interests", List.of())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.interests").isEmpty());

		Assertions.assertThat(
			memberInterestRepository.findAllByCareReceiverMemberIdOrderById(careReceiverMember.getId()))
			.isEmpty();
	}

	@Test
	void invalidInterestIsRejectedWithoutChangingExistingValues() throws Exception {
		saveInterests("existing");

		mockMvc.perform(put(path(careReceiverMember))
				.with(authenticatedAs(careReceiverMember.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("interests", List.of("   "))))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		Assertions.assertThat(
			memberInterestRepository.findAllByCareReceiverMemberIdOrderById(careReceiverMember.getId()))
			.extracting(MemberInterest::getInterestText)
			.containsExactly("existing");
	}

	@Test
	void interestLongerThanTenCharactersIsRejected() throws Exception {
		mockMvc.perform(put(path(careReceiverMember))
				.with(authenticatedAs(careReceiverMember.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("interests", List.of("12345678901"))))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void moreThanTenDistinctInterestsAreRejected() throws Exception {
		List<String> interests = java.util.stream.IntStream.rangeClosed(1, 11)
			.mapToObj(number -> "interest" + number)
			.toList();

		mockMvc.perform(put(path(careReceiverMember))
				.with(authenticatedAs(careReceiverMember.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("interests", interests)))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void unauthenticatedRequestReturnsUnauthorized() throws Exception {
		mockMvc.perform(get(path(careReceiverMember)))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void inactiveTargetCannotBeRead() throws Exception {
		mockMvc.perform(get(path(inactiveMember))
				.with(authenticatedAs(guardianMember.getUser().getId())))
			.andExpect(status().isForbidden());
	}

	/**
	 * 로그인으로 발급받은 Access Token으로 호출해 인증 필터까지 함께 통과시킨다. 주체를 직접 주입하는
	 * 다른 테스트와 달리, 컨트롤러가 받는 주체 타입이 필터가 넣는 타입과 실제로 맞는지 확인한다.
	 */
	@Test
	void interestsCanBeReadWithAnAccessTokenIssuedByLogin() throws Exception {
		saveInterests("music");
		String accessToken = signupAndLoginAsActiveGuardian();

		mockMvc.perform(get(path(careReceiverMember))
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.memberId").value(careReceiverMember.getId()))
			.andExpect(jsonPath("$.data.interests[0]").value("music"));
	}

	private String signupAndLoginAsActiveGuardian() throws Exception {
		mockMvc.perform(post("/auth/signup")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "loginId": "interestuser",
					  "password": "password123",
					  "name": "실사용자",
					  "birthDate": "1995-03-17",
					  "gender": "MALE"
					}
					"""))
			.andExpect(status().isCreated());

		User joined = userRepository.findByLoginIdAndWithdrawnAtIsNull("interestuser").orElseThrow();
		groupMemberRepository.save(new GroupMember(
			entityManager.find(FamilyGroup.class, group.getId()),
			joined,
			GroupRole.GUARDIAN,
			false,
			Instant.now()));
		entityManager.flush();

		MvcResult result = mockMvc.perform(post("/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"loginId\": \"interestuser\", \"password\": \"password123\"}"))
			.andExpect(status().isOk())
			.andReturn();

		return objectMapper.readTree(result.getResponse().getContentAsString())
			.path("data")
			.path("accessToken")
			.asText();
	}

	private void saveInterests(String... interests) {
		memberInterestRepository.saveAll(java.util.Arrays.stream(interests)
			.map(interest -> new MemberInterest(careReceiverMember, interest))
			.toList());
		memberInterestRepository.flush();
	}

	private String path(GroupMember member) {
		return BASE_PATH.formatted(group.getId(), member.getId());
	}

	/**
	 * 인증 필터가 넣는 것과 같은 주체 타입을 주입한다. 사용자 ID만 넣으면 컨트롤러가 선언한 타입과
	 * 어긋나도 테스트가 통과해, 실제 요청에서만 주체가 {@code null}이 되는 결함을 놓친다.
	 */
	private RequestPostProcessor authenticatedAs(Long userId) {
		AuthenticatedUser principal = new AuthenticatedUser(userId, "test-access-token");
		return authentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
	}

	private String json(String field, Object value) throws Exception {
		return objectMapper.writeValueAsString(java.util.Map.of(field, value));
	}

	private User user(String loginId) {
		return new User(loginId, "password-hash", "tester", LocalDate.of(1995, 3, 17), UserGender.MALE);
	}
}
