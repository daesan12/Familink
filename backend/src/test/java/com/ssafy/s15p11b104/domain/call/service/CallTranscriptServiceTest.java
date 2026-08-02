package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallTranscript;
import com.ssafy.s15p11b104.domain.call.entity.SpeakerType;
import com.ssafy.s15p11b104.domain.call.report.CallReportGenerationRequestRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptEventClaimStore;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptEventRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptRepository;

@ExtendWith(MockitoExtension.class)
class CallTranscriptServiceTest {

	private static final long CALL_SESSION_ID = 1L;

	@Mock
	private CallSessionRepository callSessionRepository;

	@Mock
	private CallTranscriptRepository callTranscriptRepository;

	@Mock
	private CallTranscriptEventRepository transcriptEventRepository;

	@Mock
	private CallTranscriptEventClaimStore transcriptEventClaimStore;

	@Mock
	private CallReportGenerationRequestRepository reportRequestRepository;

	@Mock
	private CallReportCallRepository callReportRepository;

	@Mock
	private TransactionTemplate transactionTemplate;

	@Mock
	private CallSession callSession;

	private CallTranscriptService callTranscriptService;

	@BeforeEach
	void setUp() {
		callTranscriptService = new CallTranscriptService(
			callSessionRepository,
			callTranscriptRepository,
			transcriptEventRepository,
			transcriptEventClaimStore,
			reportRequestRepository,
			callReportRepository,
			transactionTemplate,
			Clock.fixed(Instant.parse("2026-08-02T00:00:00Z"), ZoneOffset.UTC)
		);
		when(transactionTemplate.execute(any())).thenAnswer(invocation -> {
			TransactionCallback<?> callback = invocation.getArgument(0);
			return callback.doInTransaction(null);
		});
	}

	@Test
	void savesCompletedTranscriptWithOpenAiItemId() {
		when(callSessionRepository.findByIdForUpdate(CALL_SESSION_ID)).thenReturn(Optional.of(callSession));
		when(callTranscriptRepository.existsByCallSessionIdAndOpenaiItemId(CALL_SESSION_ID, "item-1"))
			.thenReturn(false);
		ArgumentCaptor<CallTranscript> transcriptCaptor = ArgumentCaptor.forClass(CallTranscript.class);

		boolean saved = callTranscriptService.saveIfAbsent(
			CALL_SESSION_ID,
			SpeakerType.USER,
			"안녕하세요.",
			1,
			"item-1"
		);

		assertThat(saved).isTrue();
		verify(callTranscriptRepository).save(transcriptCaptor.capture());
		verify(callSession).recordTranscriptChange();
		CallTranscript transcript = transcriptCaptor.getValue();
		assertThat(transcript.getCallSession()).isSameAs(callSession);
		assertThat(transcript.getContent()).isEqualTo("안녕하세요.");
		assertThat(transcript.getOpenaiItemId()).isEqualTo("item-1");
	}

	@Test
	void skipsExistingTranscriptForSameSessionAndItem() {
		when(callSessionRepository.findByIdForUpdate(CALL_SESSION_ID)).thenReturn(Optional.of(callSession));
		when(callTranscriptRepository.existsByCallSessionIdAndOpenaiItemId(CALL_SESSION_ID, "item-1"))
			.thenReturn(true);

		boolean saved = callTranscriptService.saveIfAbsent(
			CALL_SESSION_ID,
			SpeakerType.USER,
			"안녕하세요.",
			1,
			"item-1"
		);

		assertThat(saved).isFalse();
	}
}
