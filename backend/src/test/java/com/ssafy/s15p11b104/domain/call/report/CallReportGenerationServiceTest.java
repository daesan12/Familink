package com.ssafy.s15p11b104.domain.call.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
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
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.entity.CallTranscript;
import com.ssafy.s15p11b104.domain.call.entity.SpeakerType;
import com.ssafy.s15p11b104.domain.call.entity.TranscriptIngestStatus;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptEventRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptRepository;
import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;
import com.ssafy.s15p11b104.domain.report.service.DailyReportGenerationDispatcher;

@ExtendWith(MockitoExtension.class)
class CallReportGenerationServiceTest {

	private static final long CALL_SESSION_ID = 1L;
	private static final long TRANSCRIPT_REVISION = 5L;
	private static final Instant NOW = Instant.parse("2026-07-31T13:01:00Z");

	@Mock
	private CallSessionRepository callSessionRepository;

	@Mock
	private CallTranscriptRepository callTranscriptRepository;

	@Mock
	private CallTranscriptEventRepository transcriptEventRepository;

	@Mock
	private CallReportCallRepository callReportRepository;

	@Mock
	private CallReportGenerationRequestRepository requestRepository;

	@Mock
	private CallReportAnalyzer analyzer;

	@Mock
	private DailyReportGenerationDispatcher dailyReportGenerationDispatcher;

	@Mock
	private TransactionTemplate transactionTemplate;

	@Mock
	private ApplicationEventPublisher eventPublisher;

	@Mock
	private CallSession callSession;

	@Mock
	private CallTranscript transcript;

	private CallReportGenerationRequest request;
	private CallReportGenerationService generationService;

	@BeforeEach
	void setUp() {
		generationService = new CallReportGenerationService(
			callSessionRepository,
			callTranscriptRepository,
			transcriptEventRepository,
			callReportRepository,
			requestRepository,
			analyzer,
			dailyReportGenerationDispatcher,
			Clock.fixed(NOW, ZoneOffset.UTC),
			transactionTemplate,
			eventPublisher
		);
		when(transactionTemplate.execute(any())).thenAnswer(invocation -> {
			TransactionCallback<?> callback = invocation.getArgument(0);
			return callback.doInTransaction(null);
		});
		org.mockito.Mockito.lenient().doAnswer(invocation -> {
			Consumer<TransactionStatus> callback = invocation.getArgument(0);
			callback.accept(null);
			return null;
		}).when(transactionTemplate).executeWithoutResult(any());
		request = new CallReportGenerationRequest(CALL_SESSION_ID, TRANSCRIPT_REVISION);
	}

	@Test
	void claimsAnalyzesAndStoresOnlyTheFinalizedRevision() {
		stubEligibleSession();
		when(callSession.getEndedAt()).thenReturn(Instant.parse("2026-07-31T12:59:59Z"));
		CallReportAnalysis analysis = new CallReportAnalysis(
			"시장에 다녀온 이야기를 나눴습니다.",
			EmotionCategory.JOY,
			"반가움",
			"주말에 방문해 주세요."
		);
		when(analyzer.analyze(any())).thenReturn(analysis);
		ArgumentCaptor<CallReport> reportCaptor = ArgumentCaptor.forClass(CallReport.class);

		generationService.generate(CALL_SESSION_ID);

		verify(callReportRepository).saveAndFlush(reportCaptor.capture());
		assertThat(reportCaptor.getValue().getSummary()).isEqualTo(analysis.summary());
		assertThat(request.getStatus()).isEqualTo(CallReportGenerationStatus.DONE);
		verify(dailyReportGenerationDispatcher).dispatch(LocalDate.of(2026, 7, 31));
	}

	@Test
	void recordsExplicitGeminiFailureWithoutSavingReport() {
		stubEligibleSession();
		when(analyzer.analyze(any())).thenThrow(new CallReportAnalysisException("분석 실패"));

		generationService.generate(CALL_SESSION_ID);

		assertThat(request.getStatus()).isEqualTo(CallReportGenerationStatus.GEMINI_FAILED);
		assertThat(request.getLastFailureCode()).isEqualTo("ANALYSIS_FAILED");
		verify(callReportRepository, never()).saveAndFlush(any());
	}

	@Test
	void leavesStaleFailedClaimRecoverableWhenTranscriptRevisionChanges() {
		stubEligibleSession();
		when(callSession.getTranscriptRevision()).thenReturn(TRANSCRIPT_REVISION, TRANSCRIPT_REVISION + 1);
		when(analyzer.analyze(any())).thenThrow(new CallReportAnalysisException("분석 실패"));

		generationService.generate(CALL_SESSION_ID);

		assertThat(request.getStatus()).isEqualTo(CallReportGenerationStatus.CLAIMED);
		assertThat(request.getLastFailureCode()).isNull();
		verify(callReportRepository, never()).saveAndFlush(any());
	}

	@Test
	void skipsSessionWithoutCompleteTranscriptIntegrity() {
		when(callSessionRepository.findByIdForUpdate(CALL_SESSION_ID)).thenReturn(Optional.of(callSession));
		when(requestRepository.findByIdForUpdate(CALL_SESSION_ID)).thenReturn(Optional.of(request));
		when(callSession.getStatus()).thenReturn(CallStatus.COMPLETED);
		when(callSession.isTranscriptComplete()).thenReturn(false);

		generationService.generate(CALL_SESSION_ID);

		verify(analyzer, never()).analyze(any());
		assertThat(request.getStatus()).isEqualTo(CallReportGenerationStatus.PENDING);
	}

	@Test
	void discardsAnalysisWhenTranscriptRevisionChanges() {
		stubEligibleSession();
		when(callSession.getTranscriptRevision()).thenReturn(TRANSCRIPT_REVISION, TRANSCRIPT_REVISION + 1);
		when(analyzer.analyze(any())).thenReturn(new CallReportAnalysis(
			"인사를 나눴습니다.",
			EmotionCategory.NEUTRAL,
			"차분함",
			null
		));

		generationService.generate(CALL_SESSION_ID);

		verify(callReportRepository, never()).saveAndFlush(any());
		assertThat(request.getStatus()).isEqualTo(CallReportGenerationStatus.CLAIMED);
	}

	@Test
	void marksRequestDoneWhenReportAlreadyExists() {
		when(callSessionRepository.findByIdForUpdate(CALL_SESSION_ID)).thenReturn(Optional.of(callSession));
		when(requestRepository.findByIdForUpdate(CALL_SESSION_ID)).thenReturn(Optional.of(request));
		when(callReportRepository.existsByCallSessionId(CALL_SESSION_ID)).thenReturn(true);

		generationService.generate(CALL_SESSION_ID);

		assertThat(request.getStatus()).isEqualTo(CallReportGenerationStatus.DONE);
		verify(analyzer, never()).analyze(any());
	}

	private void stubEligibleSession() {
		when(callSessionRepository.findByIdForUpdate(CALL_SESSION_ID)).thenReturn(Optional.of(callSession));
		when(requestRepository.findByIdForUpdate(CALL_SESSION_ID)).thenReturn(Optional.of(request));
		when(callSession.getStatus()).thenReturn(CallStatus.COMPLETED);
		when(callSession.isTranscriptComplete()).thenReturn(true);
		when(callSession.getTranscriptRevision()).thenReturn(TRANSCRIPT_REVISION);
		when(transcriptEventRepository.countByCallSessionIdAndStatusNot(
			CALL_SESSION_ID,
			TranscriptIngestStatus.APPLIED
		)).thenReturn(0L);
		when(callReportRepository.existsByCallSessionId(CALL_SESSION_ID)).thenReturn(false);
		when(transcript.getSequenceNumber()).thenReturn(1);
		when(transcript.getSpeaker()).thenReturn(SpeakerType.USER);
		when(transcript.getContent()).thenReturn("안녕하세요.");
		when(callTranscriptRepository.findAllByCallSessionIdOrderBySequenceNumberAsc(CALL_SESSION_ID))
			.thenReturn(List.of(transcript));
	}
}
