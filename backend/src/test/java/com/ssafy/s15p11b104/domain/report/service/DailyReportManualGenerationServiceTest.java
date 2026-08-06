package com.ssafy.s15p11b104.domain.report.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.report.dto.DailyReportGenerationStatus;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

@ExtendWith(MockitoExtension.class)
class DailyReportManualGenerationServiceTest {

	private static final Long GROUP_ID = 1L;
	private static final Long MEMBER_ID = 11L;
	private static final Long USER_ID = 21L;
	private static final LocalDate REPORT_DATE = LocalDate.of(2026, 8, 6);
	private static final UUID TOKEN = UUID.fromString("01234567-89ab-cdef-0123-456789abcdef");

	@Mock
	private GroupMemberRepository groupMemberRepository;

	@Mock
	private DailyReportGenerationService generationService;

	@Mock
	private DailyReportGenerationDispatcher dispatcher;

	@Mock
	private GroupMember requester;

	@Mock
	private GroupMember target;

	private DailyReportManualGenerationService service;

	@BeforeEach
	void setUp() {
		service = new DailyReportManualGenerationService(
			groupMemberRepository,
			generationService,
			dispatcher,
			Clock.fixed(Instant.parse("2026-08-06T03:00:00Z"), ZoneOffset.UTC));
		when(groupMemberRepository.findActiveByGroupIdAndUserId(GROUP_ID, USER_ID))
			.thenReturn(Optional.of(requester));
		when(requester.getRole()).thenReturn(GroupRole.GUARDIAN);
		when(groupMemberRepository.findActiveByGroupIdAndMemberId(GROUP_ID, MEMBER_ID))
			.thenReturn(Optional.of(target));
		when(target.getRole()).thenReturn(GroupRole.CARE_RECEIVER);
	}

	@Test
	void claimsAndDispatchesTodaysReport() {
		when(generationService.claimManual(REPORT_DATE, MEMBER_ID))
			.thenReturn(new DailyReportGenerationService.ManualClaim(
				DailyReportGenerationStatus.GENERATING, TOKEN));
		when(dispatcher.dispatchManual(REPORT_DATE, MEMBER_ID, TOKEN)).thenReturn(true);

		var response = service.request(GROUP_ID, MEMBER_ID, USER_ID);

		assertThat(response.reportDate()).isEqualTo(REPORT_DATE);
		assertThat(response.generationStatus()).isEqualTo(DailyReportGenerationStatus.GENERATING);
		verify(dispatcher).dispatchManual(REPORT_DATE, MEMBER_ID, TOKEN);
	}

	@Test
	void releasesClaimWhenExecutorRejectsTask() {
		when(generationService.claimManual(REPORT_DATE, MEMBER_ID))
			.thenReturn(new DailyReportGenerationService.ManualClaim(
				DailyReportGenerationStatus.GENERATING, TOKEN));

		assertThatThrownBy(() -> service.request(GROUP_ID, MEMBER_ID, USER_ID))
			.isInstanceOfSatisfying(BusinessException.class, exception ->
				assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.DAILY_REPORT_GENERATION_BUSY));
		verify(generationService).releaseManualClaim(REPORT_DATE, MEMBER_ID, TOKEN);
	}

	@Test
	void rejectsRequestWithoutReadyCallReport() {
		when(generationService.claimManual(REPORT_DATE, MEMBER_ID))
			.thenReturn(new DailyReportGenerationService.ManualClaim(
				DailyReportGenerationStatus.NOT_READY, null));

		assertThatThrownBy(() -> service.request(GROUP_ID, MEMBER_ID, USER_ID))
			.isInstanceOfSatisfying(BusinessException.class, exception ->
				assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.DAILY_REPORT_INPUT_NOT_READY));
		verify(dispatcher, never()).dispatchManual(REPORT_DATE, MEMBER_ID, TOKEN);
	}

	@Test
	void returnsReadyWithoutDispatchWhenReportAlreadyExists() {
		when(generationService.claimManual(REPORT_DATE, MEMBER_ID))
			.thenReturn(new DailyReportGenerationService.ManualClaim(
				DailyReportGenerationStatus.READY, null));

		var response = service.request(GROUP_ID, MEMBER_ID, USER_ID);

		assertThat(response.generationStatus()).isEqualTo(DailyReportGenerationStatus.READY);
		verify(dispatcher, never()).dispatchManual(REPORT_DATE, MEMBER_ID, TOKEN);
	}

	@Test
	void returnsGeneratingWithoutDuplicateDispatchWhenClaimAlreadyExists() {
		when(generationService.claimManual(REPORT_DATE, MEMBER_ID))
			.thenReturn(new DailyReportGenerationService.ManualClaim(
				DailyReportGenerationStatus.GENERATING, null));

		var response = service.request(GROUP_ID, MEMBER_ID, USER_ID);

		assertThat(response.generationStatus()).isEqualTo(DailyReportGenerationStatus.GENERATING);
		verify(dispatcher, never()).dispatchManual(REPORT_DATE, MEMBER_ID, TOKEN);
	}
}
