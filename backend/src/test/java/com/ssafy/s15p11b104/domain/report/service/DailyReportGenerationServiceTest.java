package com.ssafy.s15p11b104.domain.report.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.report.entity.DailyReport;
import com.ssafy.s15p11b104.domain.report.entity.DailyReportGenerationClaim;
import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;
import com.ssafy.s15p11b104.domain.report.dto.DailyReportGenerationStatus;
import com.ssafy.s15p11b104.domain.report.repository.DailyReportGenerationClaimRepository;
import com.ssafy.s15p11b104.domain.report.repository.DailyReportRepository;

@ExtendWith(MockitoExtension.class)
class DailyReportGenerationServiceTest {

	private static final LocalDate REPORT_DATE = LocalDate.of(2026, 7, 30);
	private static final Instant NOW = Instant.parse("2026-07-30T14:00:00Z");

	@Mock
	private CallReportCallRepository callReportRepository;

	@Mock
	private CallSessionRepository callSessionRepository;

	@Mock
	private DailyReportRepository dailyReportRepository;

	@Mock
	private DailyReportGenerationClaimRepository claimRepository;

	@Mock
	private GroupMemberRepository groupMemberRepository;

	@Mock
	private DailyReportAnalyzer analyzer;

	@Mock
	private TransactionTemplate transactionTemplate;

	@Mock
	private ApplicationEventPublisher eventPublisher;

	@Mock
	private GroupMember member;

	@Mock
	private FamilyGroup group;

	private final AtomicReference<DailyReportGenerationClaim> storedClaim = new AtomicReference<>();
	private final AtomicBoolean inTransaction = new AtomicBoolean();
	private DailyReportGenerationService generationService;

	@BeforeEach
	void setUp() {
		generationService = new DailyReportGenerationService(
			callReportRepository,
			callSessionRepository,
			dailyReportRepository,
			claimRepository,
			groupMemberRepository,
			analyzer,
			transactionTemplate,
			eventPublisher,
			Clock.fixed(NOW, ZoneOffset.UTC));
		lenient().when(transactionTemplate.execute(any())).thenAnswer(invocation -> {
			inTransaction.set(true);
			try {
				return invocation.<TransactionCallback<?>>getArgument(0).doInTransaction(null);
			} finally {
				inTransaction.set(false);
			}
		});
		lenient().when(groupMemberRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(member));
		lenient().when(member.isActive()).thenReturn(true);
		lenient().when(member.getGroup()).thenReturn(group);
		lenient().when(claimRepository.findForUpdate(11L, REPORT_DATE))
			.thenAnswer(invocation -> Optional.ofNullable(storedClaim.get()));
		lenient().when(claimRepository.save(any(DailyReportGenerationClaim.class))).thenAnswer(invocation -> {
			DailyReportGenerationClaim claim = invocation.getArgument(0);
			storedClaim.set(claim);
			return claim;
		});
		lenient().doAnswer(invocation -> {
			storedClaim.set(null);
			return null;
		}).when(claimRepository).delete(any(DailyReportGenerationClaim.class));
	}

	@Test
	void doesNothingWhenThereAreNoCallReports() {
		when(callReportRepository.findCompletedInEndedAtRange(any(), any(), any())).thenReturn(List.of());

		generationService.generate(REPORT_DATE);

		verify(analyzer, never()).analyze(any());
		verify(dailyReportRepository, never()).save(any());
	}

	@Test
	void generatesReadyMemberOnceAndRemovesClaim() {
		CallReport report = report(101L, "통화 요약", null);
		stubInitialAndMemberReports(List.of(report), List.of(report));
		when(analyzer.analyze(any())).thenAnswer(invocation -> {
			assertThat(inTransaction).isFalse();
			return analysis("하루 요약");
		});

		generationService.generate(REPORT_DATE);

		verify(analyzer).analyze(any());
		verify(dailyReportRepository).save(any(DailyReport.class));
		verify(claimRepository).delete(any(DailyReportGenerationClaim.class));
		assertThat(storedClaim).hasValue(null);
	}

	@Test
	void activeOtherClaimPreventsDuplicateGeminiCall() {
		CallReport report = report(101L, "통화 요약", null);
		stubInitialAndMemberReports(List.of(report), List.of(report));
		storedClaim.set(new DailyReportGenerationClaim(
			11L, REPORT_DATE, UUID.randomUUID(), NOW.plusSeconds(60), 1, 101L));

		generationService.generate(REPORT_DATE);

		verify(analyzer, never()).analyze(any());
		verify(dailyReportRepository, never()).save(any());
	}

	@Test
	void analyzerFailureLeavesClaimUntilLeaseExpiry() {
		CallReport report = report(101L, "실패 대상", null);
		stubInitialAndMemberReports(List.of(report), List.of(report));
		when(analyzer.analyze(any())).thenThrow(new DailyReportAnalysisException("upstream"));

		generationService.generate(REPORT_DATE);

		verify(dailyReportRepository, never()).save(any());
		verify(claimRepository, never()).delete(any(DailyReportGenerationClaim.class));
		assertThat(storedClaim.get()).isNotNull();
	}

	@Test
	void changedInputDiscardsOldResultAndRegeneratesWithLatestReports() {
		CallReport first = report(101L, "첫 통화", null);
		CallReport second = report(102L, "추가 통화", "확인 메모");
		when(callReportRepository.findCompletedInEndedAtRange(any(), any(), any()))
			.thenReturn(List.of(first));
		when(callReportRepository.findCompletedForMemberInEndedAtRange(anyLong(), any(), any(), any()))
			.thenReturn(List.of(first), List.of(first, second), List.of(first, second), List.of(first, second));
		when(analyzer.analyze(any()))
			.thenReturn(analysis("폐기할 결과"), analysis("최신 결과"));

		generationService.generate(REPORT_DATE);

		verify(analyzer, org.mockito.Mockito.times(2)).analyze(any());
		verify(dailyReportRepository).save(any(DailyReport.class));
	}

	@Test
	void manualGenerationUsesReadyReportsEvenWhenAnotherReportIsMissing() {
		CallReport readyReport = report(101L, "준비된 통화", null);
		when(callReportRepository.findCompletedForMemberInEndedAtRange(anyLong(), any(), any(), any()))
			.thenReturn(List.of(readyReport));
		when(analyzer.analyze(any())).thenReturn(analysis("준비된 입력 요약"));

		DailyReportGenerationService.ManualClaim claim = generationService.claimManual(REPORT_DATE, 11L);
		generationService.generateManual(REPORT_DATE, 11L, claim.token());

		assertThat(claim.status()).isEqualTo(DailyReportGenerationStatus.GENERATING);
		assertThat(claim.needsDispatch()).isTrue();
		verify(analyzer).analyze(any());
		verify(dailyReportRepository).save(any(DailyReport.class));
		verify(callSessionRepository, never())
			.findCareReceiverMemberIdsWithCompletedWithoutReportInEndedAtRange(any(), any(), any());
	}

	@Test
	void manualAnalyzerFailureReleasesOwnedClaimForRetry() {
		CallReport report = report(101L, "실패 대상", null);
		when(callReportRepository.findCompletedForMemberInEndedAtRange(anyLong(), any(), any(), any()))
			.thenReturn(List.of(report));
		when(analyzer.analyze(any())).thenThrow(new DailyReportAnalysisException("upstream"));

		DailyReportGenerationService.ManualClaim claim = generationService.claimManual(REPORT_DATE, 11L);
		generationService.generateManual(REPORT_DATE, 11L, claim.token());

		verify(dailyReportRepository, never()).save(any());
		verify(claimRepository).delete(any(DailyReportGenerationClaim.class));
		assertThat(storedClaim).hasValue(null);
	}

	private void stubInitialAndMemberReports(List<CallReport> initial, List<CallReport> current) {
		when(callReportRepository.findCompletedInEndedAtRange(any(), any(), any())).thenReturn(initial);
		when(callReportRepository.findCompletedForMemberInEndedAtRange(anyLong(), any(), any(), any()))
			.thenReturn(current);
	}

	private CallReport report(Long id, String summary, String guardianMessage) {
		CallReport report = org.mockito.Mockito.mock(CallReport.class);
		CallSession session = org.mockito.Mockito.mock(CallSession.class);
		when(report.getId()).thenReturn(id);
		when(report.getSummary()).thenReturn(summary);
		when(report.getGuardianMessage()).thenReturn(guardianMessage);
		lenient().when(report.getCallSession()).thenReturn(session);
		lenient().when(session.getCareReceiverMember()).thenReturn(member);
		lenient().when(member.getId()).thenReturn(11L);
		return report;
	}

	private DailyReportAnalysis analysis(String summary) {
		return new DailyReportAnalysis(summary, EmotionCategory.NEUTRAL, "차분함", null);
	}
}
