package com.ssafy.s15p11b104.domain.call.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.entity.CallTranscript;
import com.ssafy.s15p11b104.domain.call.entity.SpeakerType;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptRepository;
import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;

@ExtendWith(MockitoExtension.class)
class CallReportGenerationServiceTest {

	private static final long CALL_SESSION_ID = 1L;

	@Mock
	private CallSessionRepository callSessionRepository;

	@Mock
	private CallTranscriptRepository callTranscriptRepository;

	@Mock
	private CallReportCallRepository callReportRepository;

	@Mock
	private CallReportAnalyzer analyzer;

	@Mock
	private TransactionTemplate transactionTemplate;

	@Mock
	private CallSession callSession;

	@Mock
	private CallTranscript userTranscript;

	@Mock
	private CallTranscript assistantTranscript;

	private CallReportGenerationService generationService;

	@BeforeEach
	void setUp() {
		generationService = new CallReportGenerationService(
			callSessionRepository,
			callTranscriptRepository,
			callReportRepository,
			analyzer,
			transactionTemplate
		);
		lenient().when(transactionTemplate.execute(any())).thenAnswer(invocation -> {
			TransactionCallback<?> callback = invocation.getArgument(0);
			return callback.doInTransaction(null);
		});
		lenient().doAnswer(invocation -> {
			Consumer<TransactionStatus> callback = invocation.getArgument(0);
			callback.accept(null);
			return null;
		}).when(transactionTemplate).executeWithoutResult(any());
	}

	@Test
	void generatesAndStoresReportFromOrderedCompletedTranscripts() {
		stubEligibleSession();
		when(callSessionRepository.findByIdForUpdate(CALL_SESSION_ID)).thenReturn(Optional.of(callSession));
		when(userTranscript.getSequenceNumber()).thenReturn(1);
		when(userTranscript.getSpeaker()).thenReturn(SpeakerType.USER);
		when(userTranscript.getContent()).thenReturn("오늘 시장에 다녀왔어요.");
		when(assistantTranscript.getSequenceNumber()).thenReturn(2);
		when(assistantTranscript.getSpeaker()).thenReturn(SpeakerType.ASSISTANT);
		when(assistantTranscript.getContent()).thenReturn("무엇을 사셨어요?");
		when(callTranscriptRepository.findAllByCallSessionIdOrderBySequenceNumberAsc(CALL_SESSION_ID))
			.thenReturn(List.of(userTranscript, assistantTranscript));
		CallReportAnalysis analysis = new CallReportAnalysis(
			"시장에 다녀온 이야기를 나눴습니다.",
			EmotionCategory.JOY,
			"반가움",
			"주말에 방문해 주세요."
		);
		when(analyzer.analyze(any())).thenReturn(analysis);
		ArgumentCaptor<CallReportInput> inputCaptor = ArgumentCaptor.forClass(CallReportInput.class);
		ArgumentCaptor<CallReport> reportCaptor = ArgumentCaptor.forClass(CallReport.class);

		generationService.generate(CALL_SESSION_ID);

		verify(analyzer).analyze(inputCaptor.capture());
		assertThat(inputCaptor.getValue().transcripts())
			.extracting(CallReportInput.TranscriptLine::sequenceNumber)
			.containsExactly(1, 2);
		verify(callReportRepository).save(reportCaptor.capture());
		CallReport report = reportCaptor.getValue();
		assertThat(report.getCallSession()).isSameAs(callSession);
		assertThat(report.getSummary()).isEqualTo(analysis.summary());
		assertThat(report.getEmotionCategory()).isEqualTo(analysis.emotionCategory());
		assertThat(report.getEmotionSubcategory()).isEqualTo(analysis.emotionSubcategory());
		assertThat(report.getGuardianMessage()).isEqualTo(analysis.guardianMessage());
	}

	@Test
	void skipsExistingReportBeforeCallingAnalyzer() {
		when(callSessionRepository.findById(CALL_SESSION_ID)).thenReturn(Optional.of(callSession));
		when(callSession.getStatus()).thenReturn(CallStatus.COMPLETED);
		when(callReportRepository.existsByCallSessionId(CALL_SESSION_ID)).thenReturn(true);

		generationService.generate(CALL_SESSION_ID);

		verify(analyzer, never()).analyze(any());
		verify(callReportRepository, never()).save(any());
	}

	@Test
	void skipsNonCompletedSession() {
		when(callSessionRepository.findById(CALL_SESSION_ID)).thenReturn(Optional.of(callSession));
		when(callSession.getStatus()).thenReturn(CallStatus.INCOMPLETE);

		generationService.generate(CALL_SESSION_ID);

		verify(callTranscriptRepository, never()).findAllByCallSessionIdOrderBySequenceNumberAsc(any());
		verify(analyzer, never()).analyze(any());
	}

	@Test
	void skipsBlankTranscripts() {
		stubEligibleSession();
		when(userTranscript.getContent()).thenReturn("   ");
		when(callTranscriptRepository.findAllByCallSessionIdOrderBySequenceNumberAsc(CALL_SESSION_ID))
			.thenReturn(List.of(userTranscript));

		generationService.generate(CALL_SESSION_ID);

		verify(analyzer, never()).analyze(any());
		verify(callReportRepository, never()).save(any());
	}

	@Test
	void doesNotStoreReportWhenAnalyzerFails() {
		stubEligibleSession();
		when(userTranscript.getSequenceNumber()).thenReturn(1);
		when(userTranscript.getSpeaker()).thenReturn(SpeakerType.USER);
		when(userTranscript.getContent()).thenReturn("안녕하세요.");
		when(callTranscriptRepository.findAllByCallSessionIdOrderBySequenceNumberAsc(CALL_SESSION_ID))
			.thenReturn(List.of(userTranscript));
		when(analyzer.analyze(any())).thenThrow(new CallReportAnalysisException("분석 실패"));

		assertThatThrownBy(() -> generationService.generate(CALL_SESSION_ID))
			.isInstanceOf(CallReportAnalysisException.class);
		verify(callReportRepository, never()).save(any());
	}

	@Test
	void rechecksDuplicateWhileHoldingSessionLock() {
		stubEligibleSession();
		when(userTranscript.getSequenceNumber()).thenReturn(1);
		when(userTranscript.getSpeaker()).thenReturn(SpeakerType.USER);
		when(userTranscript.getContent()).thenReturn("안녕하세요.");
		when(callTranscriptRepository.findAllByCallSessionIdOrderBySequenceNumberAsc(CALL_SESSION_ID))
			.thenReturn(List.of(userTranscript));
		when(analyzer.analyze(any())).thenReturn(new CallReportAnalysis(
			"인사를 나눴습니다.",
			EmotionCategory.NEUTRAL,
			"차분함",
			null
		));
		when(callSessionRepository.findByIdForUpdate(CALL_SESSION_ID)).thenReturn(Optional.of(callSession));
		when(callReportRepository.existsByCallSessionId(CALL_SESSION_ID)).thenReturn(false, true);

		generationService.generate(CALL_SESSION_ID);

		verify(callReportRepository, never()).save(any());
	}

	private void stubEligibleSession() {
		when(callSessionRepository.findById(CALL_SESSION_ID)).thenReturn(Optional.of(callSession));
		when(callSession.getStatus()).thenReturn(CallStatus.COMPLETED);
		when(callReportRepository.existsByCallSessionId(CALL_SESSION_ID)).thenReturn(false);
	}
}
