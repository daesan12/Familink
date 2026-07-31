package com.ssafy.s15p11b104.domain.report.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.report.entity.DailyReport;
import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;
import com.ssafy.s15p11b104.domain.report.repository.DailyReportRepository;

@ExtendWith(MockitoExtension.class)
class DailyReportGenerationServiceTest {

	private static final LocalDate REPORT_DATE = LocalDate.of(2026, 7, 30);

	@Mock
	private CallReportCallRepository callReportRepository;

	@Mock
	private CallSessionRepository callSessionRepository;

	@Mock
	private DailyReportRepository dailyReportRepository;

	@Mock
	private GroupMemberRepository groupMemberRepository;

	@Mock
	private DailyReportAnalyzer analyzer;

	@Mock
	private TransactionTemplate transactionTemplate;

	@Mock
	private ApplicationEventPublisher eventPublisher;

	@Mock
	private CallReport firstReport;

	@Mock
	private CallReport secondReport;

	@Mock
	private CallReport otherMemberReport;

	@Mock
	private CallSession firstSession;

	@Mock
	private CallSession secondSession;

	@Mock
	private CallSession otherSession;

	@Mock
	private GroupMember firstMember;

	@Mock
	private GroupMember otherMember;

	@Mock
	private FamilyGroup firstGroup;

	@Mock
	private FamilyGroup otherGroup;

	private DailyReportGenerationService generationService;

	@BeforeEach
	void setUp() {
		generationService = new DailyReportGenerationService(
			callReportRepository,
			callSessionRepository,
			dailyReportRepository,
			groupMemberRepository,
			analyzer,
			transactionTemplate,
			eventPublisher
		);
		lenient().doAnswer(invocation -> {
			Consumer<TransactionStatus> callback = invocation.getArgument(0);
			callback.accept(null);
			return null;
		}).when(transactionTemplate).executeWithoutResult(any());
	}

	@Test
	void waitsForCompletedCallReportsBeforeGeneratingDailyReports() {
		when(callSessionRepository.findCareReceiverMemberIdsWithCompletedWithoutReportInEndedAtRange(any(), any(), any()))
			.thenReturn(List.of(11L));

		generationService.generate(REPORT_DATE);

		verify(analyzer, never()).analyze(any());
	}

	@Test
	void generatesReadyMemberReportWhenAnotherMemberReportIsMissing() {
		stubReport(otherMemberReport, otherSession, otherMember, 22L, "준비된 통화 요약", null);
		when(callSessionRepository.findCareReceiverMemberIdsWithCompletedWithoutReportInEndedAtRange(any(), any(), any()))
			.thenReturn(List.of(11L));
		when(callReportRepository.findCompletedInEndedAtRange(any(), any(), any()))
			.thenReturn(List.of(otherMemberReport));
		when(dailyReportRepository.existsByCareReceiverMemberIdAndReportDate(22L, REPORT_DATE)).thenReturn(false);
		when(analyzer.analyze(any())).thenReturn(new DailyReportAnalysis(
			"준비된 일일 요약",
			EmotionCategory.NEUTRAL,
			"차분함",
			null
		));
		when(groupMemberRepository.findByIdForUpdate(22L)).thenReturn(Optional.of(otherMember));
		when(otherMember.getGroup()).thenReturn(otherGroup);

		generationService.generate(REPORT_DATE);

		verify(analyzer).analyze(any());
		verify(dailyReportRepository).save(any(DailyReport.class));
	}

	@Test
	void doesNothingWhenThereAreNoCallReports() {
		when(callReportRepository.findCompletedInEndedAtRange(any(), any(), any())).thenReturn(List.of());

		generationService.generate(REPORT_DATE);

		verify(analyzer, never()).analyze(any());
		verify(dailyReportRepository, never()).save(any());
	}

	@Test
	void groupsReportsByMemberAndSendsAllFieldsInOrder() {
		stubReport(firstReport, firstSession, firstMember, 11L, "첫 통화 요약", "첫 메모");
		stubReport(secondReport, secondSession, firstMember, 11L, "두 번째 통화 요약", null);
		stubReport(otherMemberReport, otherSession, otherMember, 22L, "다른 피보호자 요약", "다른 메모");
		when(callReportRepository.findCompletedInEndedAtRange(any(), any(), any()))
			.thenReturn(List.of(firstReport, secondReport, otherMemberReport));
		when(dailyReportRepository.existsByCareReceiverMemberIdAndReportDate(any(), eq(REPORT_DATE)))
			.thenReturn(false);
		when(analyzer.analyze(any())).thenReturn(new DailyReportAnalysis(
			"하루 요약",
			EmotionCategory.JOY,
			"따뜻함",
			"방문해 주세요."
		));
		when(groupMemberRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(firstMember));
		when(groupMemberRepository.findByIdForUpdate(22L)).thenReturn(Optional.of(otherMember));
		when(firstMember.getGroup()).thenReturn(firstGroup);
		when(otherMember.getGroup()).thenReturn(otherGroup);

		ArgumentCaptor<DailyReportInput> inputCaptor = ArgumentCaptor.forClass(DailyReportInput.class);
		ArgumentCaptor<DailyReport> reportCaptor = ArgumentCaptor.forClass(DailyReport.class);

		generationService.generate(REPORT_DATE);

		verify(analyzer, org.mockito.Mockito.times(2)).analyze(inputCaptor.capture());
		assertThat(inputCaptor.getAllValues().get(0).callReports())
			.extracting(DailyReportInput.CallReportContext::summary)
			.containsExactly("첫 통화 요약", "두 번째 통화 요약");
		assertThat(inputCaptor.getAllValues().get(0).callReports())
			.extracting(DailyReportInput.CallReportContext::guardianMessage)
			.containsExactly("첫 메모", null);
		assertThat(inputCaptor.getAllValues().get(1).callReports())
			.extracting(DailyReportInput.CallReportContext::summary)
			.containsExactly("다른 피보호자 요약");
		verify(dailyReportRepository, org.mockito.Mockito.times(2)).save(reportCaptor.capture());
		assertThat(reportCaptor.getAllValues())
			.extracting(DailyReport::getReportDate)
			.containsOnly(REPORT_DATE);
		assertThat(reportCaptor.getAllValues())
			.extracting(DailyReport::getGuardianMessage)
			.containsOnly("방문해 주세요.");
	}

	@Test
	void skipsExistingDailyReportWithoutCallingAnalyzer() {
		stubReport(firstReport, firstSession, firstMember, 11L, "이미 처리할 요약", null);
		when(callReportRepository.findCompletedInEndedAtRange(any(), any(), any())).thenReturn(List.of(firstReport));
		when(dailyReportRepository.existsByCareReceiverMemberIdAndReportDate(11L, REPORT_DATE)).thenReturn(true);

		generationService.generate(REPORT_DATE);

		verify(analyzer, never()).analyze(any());
		verify(dailyReportRepository, never()).save(any());
		verify(groupMemberRepository, never()).findByIdForUpdate(any());
	}

	@Test
	void continuesWithNextMemberWhenOneAnalysisFails() {
		stubReport(firstReport, firstSession, firstMember, 11L, "실패 대상", null);
		stubReport(otherMemberReport, otherSession, otherMember, 22L, "계속 처리할 대상", null);
		when(callReportRepository.findCompletedInEndedAtRange(any(), any(), any()))
			.thenReturn(List.of(firstReport, otherMemberReport));
		when(dailyReportRepository.existsByCareReceiverMemberIdAndReportDate(any(), eq(REPORT_DATE)))
			.thenReturn(false);
		when(analyzer.analyze(any()))
			.thenThrow(new DailyReportAnalysisException("민감한 업스트림 오류"))
			.thenReturn(new DailyReportAnalysis("두 번째 요약", EmotionCategory.NEUTRAL, "차분함", null));
		when(groupMemberRepository.findByIdForUpdate(22L)).thenReturn(Optional.of(otherMember));
		when(otherMember.getGroup()).thenReturn(otherGroup);

		generationService.generate(REPORT_DATE);

		verify(analyzer, org.mockito.Mockito.times(2)).analyze(any());
		verify(dailyReportRepository).save(any(DailyReport.class));
		verify(groupMemberRepository, never()).findByIdForUpdate(11L);
	}

	@Test
	void doesNotSaveWhenAnalyzerFails() {
		stubReport(firstReport, firstSession, firstMember, 11L, "실패 대상", null);
		when(callReportRepository.findCompletedInEndedAtRange(any(), any(), any())).thenReturn(List.of(firstReport));
		when(dailyReportRepository.existsByCareReceiverMemberIdAndReportDate(11L, REPORT_DATE)).thenReturn(false);
		when(analyzer.analyze(any())).thenThrow(new DailyReportAnalysisException("호출 실패"));

		generationService.generate(REPORT_DATE);

		verify(dailyReportRepository, never()).save(any());
	}

	private void stubReport(
		CallReport report,
		CallSession session,
		GroupMember member,
		Long memberId,
		String summary,
		String guardianMessage
	) {
		lenient().when(report.getCallSession()).thenReturn(session);
		lenient().when(report.getSummary()).thenReturn(summary);
		lenient().when(report.getGuardianMessage()).thenReturn(guardianMessage);
		lenient().when(session.getCareReceiverMember()).thenReturn(member);
		lenient().when(member.getId()).thenReturn(memberId);
	}
}
