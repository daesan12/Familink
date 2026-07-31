package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.GroupMemberCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.MemberAliasCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.MemberInterestCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.PostAnalysisCallRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;

@ExtendWith(MockitoExtension.class)
class AiCallPromptContextProviderTest {

	@Mock
	private GroupMemberCallRepository groupMemberRepository;
	@Mock
	private MemberInterestCallRepository memberInterestRepository;
	@Mock
	private MemberAliasCallRepository memberAliasRepository;
	@Mock
	private PostAnalysisCallRepository postAnalysisRepository;
	@Mock
	private CallReportCallRepository callReportRepository;
	@Mock
	private GroupMember careReceiver;
	@Mock
	private FamilyGroup group;
	@Mock
	private User user;

	private AiCallPromptContextProvider provider;

	@BeforeEach
	void setUp() {
		provider = new AiCallPromptContextProvider(
			groupMemberRepository,
			memberInterestRepository,
			memberAliasRepository,
			postAnalysisRepository,
			callReportRepository,
			Clock.fixed(Instant.parse("2026-07-31T00:00:00Z"), ZoneOffset.UTC)
		);

		when(careReceiver.getId()).thenReturn(1L);
		when(careReceiver.getGroup()).thenReturn(group);
		when(group.getId()).thenReturn(2L);
		when(careReceiver.getUser()).thenReturn(user);
		when(user.getName()).thenReturn("피보호자");
		when(memberInterestRepository.findAllByCareReceiverMemberIdOrderByCreatedAtAsc(1L))
			.thenReturn(List.of());
		when(memberAliasRepository.findAliases(2L, 1L)).thenReturn(List.of());
		when(groupMemberRepository.findActiveMembers(2L)).thenReturn(List.of(careReceiver));
		when(postAnalysisRepository.findSuccessfulToday(
			eq(2L),
			any(),
			any(),
			any(),
			any()
		)).thenReturn(List.of());
		when(callReportRepository.findRecent(eq(1L), eq(CallStatus.COMPLETED), any()))
			.thenReturn(List.of());
	}

	@Test
	void requestsUpToFiveCompletedRecentCalls() {
		AiCallPromptContext context = provider.load(careReceiver).promptContext();
		ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);

		verify(callReportRepository).findRecent(eq(1L), eq(CallStatus.COMPLETED), pageable.capture());
		assertThat(pageable.getValue().getPageNumber()).isZero();
		assertThat(pageable.getValue().getPageSize()).isEqualTo(5);
		assertThat(context.recentCalls()).isEmpty();
	}
}
