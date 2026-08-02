package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.ssafy.s15p11b104.domain.call.repository.GroupMemberCallRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

@ExtendWith(MockitoExtension.class)
class JwtCallActorResolverTest {

	private static final long USER_ID = 7L;
	private static final long CARE_RECEIVER_MEMBER_ID = 11L;

	@Mock
	private GroupMemberCallRepository groupMemberRepository;

	@Mock
	private GroupMember careReceiver;

	private JwtCallActorResolver resolver;

	@BeforeEach
	void setUp() {
		SecurityContextHolder.clearContext();
		resolver = new JwtCallActorResolver(groupMemberRepository);
	}

	@AfterEach
	void tearDown() {
		SecurityContextHolder.clearContext();
	}

	@Test
	void resolvesActiveCareReceiverMembershipOfAuthenticatedUser() {
		authenticate(new AuthenticatedUser(USER_ID, "access-token"));
		when(careReceiver.getId()).thenReturn(CARE_RECEIVER_MEMBER_ID);
		when(groupMemberRepository.findActiveCareReceiverByUserId(USER_ID))
			.thenReturn(Optional.of(careReceiver));

		CallActor actor = resolver.resolve();

		assertThat(actor.careReceiverMemberId()).isEqualTo(CARE_RECEIVER_MEMBER_ID);
	}

	@Test
	void rejectsMissingAuthenticationAsUnauthorized() {
		assertThatThrownBy(resolver::resolve)
			.isInstanceOfSatisfying(CallApiException.class, exception -> {
				assertThat(exception.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
				assertThat(exception.getCode()).isEqualTo("UNAUTHORIZED");
			});
	}

	@Test
	void rejectsForeignPrincipalTypeAsUnauthorized() {
		authenticate("anonymousUser");

		assertThatThrownBy(resolver::resolve)
			.isInstanceOfSatisfying(CallApiException.class, exception ->
				assertThat(exception.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));
	}

	@Test
	void rejectsUserWithoutActiveCareReceiverMembershipAsForbidden() {
		authenticate(new AuthenticatedUser(USER_ID, "access-token"));
		when(groupMemberRepository.findActiveCareReceiverByUserId(USER_ID))
			.thenReturn(Optional.empty());

		assertThatThrownBy(resolver::resolve)
			.isInstanceOfSatisfying(CallApiException.class, exception -> {
				assertThat(exception.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
				assertThat(exception.getCode()).isEqualTo("FORBIDDEN");
			});
	}

	private void authenticate(Object principal) {
		SecurityContextHolder.getContext().setAuthentication(
			new UsernamePasswordAuthenticationToken(principal, null, List.of())
		);
	}
}
