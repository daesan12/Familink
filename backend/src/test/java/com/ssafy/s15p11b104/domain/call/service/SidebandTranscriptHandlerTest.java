package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.call.entity.SpeakerType;

@ExtendWith(MockitoExtension.class)
class SidebandTranscriptHandlerTest {

	private static final long CALL_SESSION_ID = 1L;

	@Mock
	private CallTranscriptService callTranscriptService;

	private SidebandTranscriptHandler handler;

	@BeforeEach
	void setUp() {
		handler = new SidebandTranscriptHandler(
			CALL_SESSION_ID,
			new ObjectMapper(),
			callTranscriptService
		);
		lenient().when(callTranscriptService.reserveItem(anyLong(), any(), anyString()))
			.thenReturn(new CallTranscriptService.TranscriptReservation(1));
		lenient().when(callTranscriptService.completeItem(anyLong(), any(), anyString(), anyString()))
			.thenReturn(true);
	}

	@Test
	void reassemblesFragmentedUserTranscriptMessage() {
		handler.acceptText(itemAdded("user-1", "user"), true);
		String completed = completedTranscript(
			"conversation.item.input_audio_transcription.completed",
			"event-1",
			"user-1",
			" 안녕하세요. "
		);
		int split = completed.length() / 2;

		handler.acceptText(completed.substring(0, split), false);
		handler.acceptText(completed.substring(split), true);

		verify(callTranscriptService).reserveItem(CALL_SESSION_ID, SpeakerType.USER, "user-1");
		verify(callTranscriptService).completeItem(
			CALL_SESSION_ID,
			SpeakerType.USER,
			"user-1",
			" 안녕하세요. "
		);
		assertThat(handler.hasIntegrityFailure()).isFalse();
	}

	@Test
	void preservesReservationOrderInPersistentService() {
		handler.acceptText(itemAdded("user-1", "user"), true);
		handler.acceptText(itemAdded("assistant-1", "assistant"), true);
		handler.acceptText(completedTranscript(
			"response.output_audio_transcript.done",
			"event-2",
			"assistant-1",
			"반가워요."
		), true);

		verify(callTranscriptService).reserveItem(CALL_SESSION_ID, SpeakerType.USER, "user-1");
		verify(callTranscriptService).reserveItem(CALL_SESSION_ID, SpeakerType.ASSISTANT, "assistant-1");
		verify(callTranscriptService).completeItem(
			CALL_SESSION_ID,
			SpeakerType.ASSISTANT,
			"assistant-1",
			"반가워요."
		);
	}

	@Test
	void failsClosedForMalformedBlankAndProviderFailedEvents() {
		handler.acceptText("{invalid-json", true);
		handler.acceptText(itemAdded("user-1", "user"), true);
		when(callTranscriptService.completeItem(CALL_SESSION_ID, SpeakerType.USER, "user-1", "   "))
			.thenReturn(false);
		handler.acceptText(completedTranscript(
			"conversation.item.input_audio_transcription.completed",
			"event-1",
			"user-1",
			"   "
		), true);
		handler.acceptText("""
			{"type":"conversation.item.input_audio_transcription.failed","event_id":"event-2","item_id":"user-1"}
			""", true);

		verify(callTranscriptService).failSession(CALL_SESSION_ID, "MALFORMED_EVENT");
		verify(callTranscriptService).failItem(
			CALL_SESSION_ID,
			"user-1",
			"PROVIDER_TRANSCRIPTION_FAILED"
		);
		assertThat(handler.hasIntegrityFailure()).isTrue();
	}

	@Test
	void marksPersistenceFailureAndKeepsFailClosedLatch() {
		when(callTranscriptService.reserveItem(CALL_SESSION_ID, SpeakerType.USER, "user-1"))
			.thenThrow(new IllegalStateException("DB unavailable"));

		handler.acceptText(itemAdded("user-1", "user"), true);

		verify(callTranscriptService).failItem(
			CALL_SESSION_ID,
			"user-1",
			"RESERVATION_PERSISTENCE_FAILED"
		);
		assertThat(handler.hasIntegrityFailure()).isTrue();
	}

	@Test
	void keepsHandlerHealthyWhenReadyPayloadCanBeRetried() {
		handler.acceptText(itemAdded("user-1", "user"), true);
		when(callTranscriptService.completeItem(
			CALL_SESSION_ID,
			SpeakerType.USER,
			"user-1",
			"retry later"
		)).thenReturn(false);

		handler.acceptText(completedTranscript(
			"conversation.item.input_audio_transcription.completed",
			"event-1",
			"user-1",
			"retry later"
		), true);

		assertThat(handler.hasIntegrityFailure()).isFalse();
		verify(callTranscriptService, never()).failItem(anyLong(), anyString(), anyString());
	}

	@Test
	void ignoresEventsAfterClose() {
		handler.close();
		handler.acceptText(itemAdded("user-1", "user"), true);

		verify(callTranscriptService, never()).reserveItem(anyLong(), any(), anyString());
	}

	@Test
	void failsClosedWhenConnectionClosesWithIncompleteTextMessage() {
		handler.acceptText("{\"type\":", false);

		handler.close();

		verify(callTranscriptService).failSession(CALL_SESSION_ID, "TRUNCATED_TEXT_MESSAGE");
		assertThat(handler.hasIntegrityFailure()).isTrue();
	}

	private String itemAdded(String itemId, String role) {
		return """
			{"type":"conversation.item.added","item":{"id":"%s","type":"message","role":"%s"}}
			""".formatted(itemId, role);
	}

	private String completedTranscript(String type, String eventId, String itemId, String transcript) {
		return """
			{"type":"%s","event_id":"%s","item_id":"%s","transcript":"%s"}
			""".formatted(type, eventId, itemId, transcript);
	}
}
