package com.ssafy.s15p11b104.domain.group;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.entity.MemberAlias;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.group.repository.MemberAliasRepository;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

@AutoConfigureMockMvc
@Transactional
class MemberAliasApiTest extends IntegrationTest {

	private static final String BASE_PATH = "/groups/%d/members/%d/alias";

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
	private MemberAliasRepository memberAliasRepository;

	private FamilyGroup group;
	private FamilyGroup otherGroup;
	private GroupMember ownerMember;
	private GroupMember targetMember;
	private GroupMember inactiveTargetMember;
	private User outsider;

	@BeforeEach
	void setUp() {
		memberAliasRepository.deleteAll();
		groupMemberRepository.deleteAll();
		entityManager.createQuery("delete from FamilyGroup").executeUpdate();
		userRepository.deleteAll();
		entityManager.flush();

		User owner = userRepository.save(user("alias_owner", "보호자"));
		User target = userRepository.save(user("alias_target", "대상자"));
		User inactiveTarget = userRepository.save(user("alias_inactive", "탈퇴자"));
		outsider = userRepository.save(user("alias_outsider", "외부인"));
		group = entityManager.merge(new FamilyGroup("family", "ABC123"));
		otherGroup = entityManager.merge(new FamilyGroup("other", "XYZ789"));
		entityManager.flush();

		ownerMember = groupMemberRepository.save(
			new GroupMember(group, owner, GroupRole.GUARDIAN, true, Instant.now()));
		targetMember = groupMemberRepository.save(
			new GroupMember(group, target, GroupRole.CARE_RECEIVER, false, Instant.now()));
		inactiveTargetMember = groupMemberRepository.save(
			new GroupMember(group, inactiveTarget, GroupRole.CARE_RECEIVER, false, Instant.now()));
		groupMemberRepository.save(
			new GroupMember(otherGroup, outsider, GroupRole.GUARDIAN, true, Instant.now()));
		entityManager.flush();

		entityManager.createQuery("""
			update GroupMember member
			set member.leftAt = :leftAt
			where member.id = :memberId
			""")
			.setParameter("leftAt", Instant.now())
			.setParameter("memberId", inactiveTargetMember.getId())
			.executeUpdate();
		entityManager.clear();
	}

	@Test
	void activeMemberCanSetAliasForAnotherActiveMember() throws Exception {
		mockMvc.perform(put(path(targetMember))
				.with(authenticatedAs(ownerMember.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("alias", " 엄마 ")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.targetMemberId").value(targetMember.getId()))
			.andExpect(jsonPath("$.data.alias").value("엄마"));

		MemberAlias saved = memberAliasRepository
			.findByGroupIdAndOwnerMemberIdAndTargetMemberId(
				group.getId(), ownerMember.getId(), targetMember.getId())
			.orElseThrow();
		assertThat(saved.getAlias()).isEqualTo("엄마");
	}

	@Test
	void resettingAliasUpdatesTheExistingRow() throws Exception {
		memberAliasRepository.save(new MemberAlias(group, ownerMember, targetMember, "아이"));
		entityManager.flush();

		mockMvc.perform(put(path(targetMember))
				.with(authenticatedAs(ownerMember.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("alias", "엄마")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.alias").value("엄마"));

		assertThat(memberAliasRepository.count()).isEqualTo(1);
		assertThat(memberAliasRepository
			.findByGroupIdAndOwnerMemberIdAndTargetMemberId(
				group.getId(), ownerMember.getId(), targetMember.getId())
			.orElseThrow()
			.getAlias()).isEqualTo("엄마");
	}

	@Test
	void aliasIsScopedByGroupAndOwnerTargetCombination() throws Exception {
		MemberAlias saved = memberAliasRepository.save(
			new MemberAlias(group, ownerMember, targetMember, "우리 아이"));
		entityManager.flush();

		assertThat(memberAliasRepository
			.findByGroupIdAndOwnerMemberIdAndTargetMemberId(
				group.getId(), ownerMember.getId(), targetMember.getId()))
			.contains(saved);
		assertThat(memberAliasRepository
			.findByGroupIdAndOwnerMemberIdAndTargetMemberId(
				group.getId(), targetMember.getId(), ownerMember.getId()))
			.isEmpty();
		assertThat(memberAliasRepository
			.findByGroupIdAndOwnerMemberIdAndTargetMemberId(
				otherGroup.getId(), ownerMember.getId(), targetMember.getId()))
			.isEmpty();
	}

	@Test
	void missingAliasLeavesActualNameAsFallbackSource() {
		assertThat(memberAliasRepository
			.findByGroupIdAndOwnerMemberIdAndTargetMemberId(
				group.getId(), ownerMember.getId(), targetMember.getId()))
			.isEmpty();
		assertThat(targetMember.getUser().getName()).isEqualTo("대상자");
	}

	@Test
	void selfAliasIsForbidden() throws Exception {
		mockMvc.perform(put(path(ownerMember))
				.with(authenticatedAs(ownerMember.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("alias", "나")))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void outsiderCannotSetAlias() throws Exception {
		mockMvc.perform(put(path(targetMember))
				.with(authenticatedAs(outsider.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("alias", "엄마")))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void inactiveTargetCannotReceiveAlias() throws Exception {
		mockMvc.perform(put(path(inactiveTargetMember))
				.with(authenticatedAs(ownerMember.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("alias", "탈퇴자")))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void invalidAliasIsRejected() throws Exception {
		for (String alias : List.of("", "   ", "12345678901")) {
			mockMvc.perform(put(path(targetMember))
					.with(authenticatedAs(ownerMember.getUser().getId()))
					.contentType(MediaType.APPLICATION_JSON)
					.content(json("alias", alias)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		}
		assertThat(memberAliasRepository.count()).isZero();
	}

	@Test
	void nullAliasIsRejected() throws Exception {
		mockMvc.perform(put(path(targetMember))
				.with(authenticatedAs(ownerMember.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"alias\":null}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void unauthenticatedRequestReturnsUnauthorized() throws Exception {
		mockMvc.perform(put(path(targetMember))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("alias", "엄마")))
			.andExpect(status().isUnauthorized());
	}

	private String path(GroupMember member) {
		return BASE_PATH.formatted(group.getId(), member.getId());
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		return authentication(new UsernamePasswordAuthenticationToken(userId, null, List.of()));
	}

	private String json(String field, Object value) throws Exception {
		return objectMapper.writeValueAsString(java.util.Map.of(field, value));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1995, 3, 17), UserGender.MALE);
	}
}
