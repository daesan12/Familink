package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallTranscript;
import com.ssafy.s15p11b104.domain.call.entity.SpeakerType;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptRepository;

@ExtendWith(MockitoExtension.class)
class CallTranscriptServiceTest {

	private static final long CALL_SESSION_ID = 1L;

	@Mock
	private CallSessionRepository callSessionRepository;

	@Mock
	private CallTranscriptRepository callTranscriptRepository;

	@Mock
	private CallSession callSession;

	private CallTranscriptService callTranscriptService;

	@BeforeEach
	void setUp() {
		callTranscriptService = new CallTranscriptService(
			callSessionRepository,
			callTranscriptRepository
		);
	}

	@Test
	void savesCompletedTranscriptWithOpenAiItemId() {
		when(callTranscriptRepository.existsByCallSessionIdAndOpenaiItemId(CALL_SESSION_ID, "item-1"))
			.thenReturn(false);
		when(callSessionRepository.findById(CALL_SESSION_ID)).thenReturn(Optional.of(callSession));
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
		CallTranscript transcript = transcriptCaptor.getValue();
		assertThat(transcript.getCallSession()).isSameAs(callSession);
		assertThat(transcript.getSpeaker()).isEqualTo(SpeakerType.USER);
		assertThat(transcript.getContent()).isEqualTo("안녕하세요.");
		assertThat(transcript.getSequenceNumber()).isEqualTo(1);
		assertThat(transcript.getOpenaiItemId()).isEqualTo("item-1");
	}

	@Test
	void skipsExistingTranscriptForSameSessionAndItem() {
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
		verify(callSessionRepository, never()).findById(any());
		verify(callTranscriptRepository, never()).save(any());
	}
}
