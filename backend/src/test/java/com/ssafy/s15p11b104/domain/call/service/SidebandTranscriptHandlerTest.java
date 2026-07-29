package com.ssafy.s15p11b104.domain.call.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
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
	}

	@Test
	void reassemblesFragmentedUserTranscriptMessage() {
		handler.acceptText(itemAdded("user-1", "user"), true);
		String completed = userTranscriptCompleted("event-1", "user-1", " 안녕하세요. ");
		int firstEnd = completed.length() / 3;
		int secondEnd = firstEnd * 2;

		handler.acceptText(completed.substring(0, firstEnd), false);
		handler.acceptText(completed.substring(firstEnd, secondEnd), false);
		handler.acceptText(completed.substring(secondEnd), true);

		verify(callTranscriptService).saveIfAbsent(
			CALL_SESSION_ID,
			SpeakerType.USER,
			" 안녕하세요. ",
			1,
			"user-1"
		);
	}

	@Test
	void preservesConversationOrderWhenCompletionOrderDiffers() {
		handler.acceptText(itemAdded("user-1", "user"), true);
		handler.acceptText(itemAdded("assistant-1", "assistant"), true);

		handler.acceptText(assistantTranscriptDone("event-2", "assistant-1", "반가워요."), true);
		handler.acceptText(userTranscriptCompleted("event-1", "user-1", "안녕하세요."), true);

		verify(callTranscriptService).saveIfAbsent(
			CALL_SESSION_ID,
			SpeakerType.USER,
			"안녕하세요.",
			1,
			"user-1"
		);
		verify(callTranscriptService).saveIfAbsent(
			CALL_SESSION_ID,
			SpeakerType.ASSISTANT,
			"반가워요.",
			2,
			"assistant-1"
		);
	}

	@Test
	void ignoresDeltaUnknownEmptyAndFailedEvents() {
		handler.acceptText(itemAdded("user-1", "user"), true);
		handler.acceptText("""
			{"type":"conversation.item.input_audio_transcription.delta","item_id":"user-1","delta":"안녕"}
			""", true);
		handler.acceptText(userTranscriptCompleted("event-1", "user-1", "   "), true);
		handler.acceptText("""
			{"type":"unknown.event","event_id":"event-unknown"}
			""", true);
		handler.acceptText(itemAdded("user-2", "user"), true);
		handler.acceptText("""
			{
			  "type":"conversation.item.input_audio_transcription.failed",
			  "event_id":"event-2",
			  "item_id":"user-2"
			}
			""", true);

		verify(callTranscriptService, never()).saveIfAbsent(
			anyLong(),
			any(SpeakerType.class),
			anyString(),
			anyInt(),
			anyString()
		);
	}

	@Test
	void savesDuplicateCompletedEventOnlyOnce() {
		handler.acceptText(itemAdded("user-1", "user"), true);
		String completed = userTranscriptCompleted("event-1", "user-1", "안녕하세요.");

		handler.acceptText(completed, true);
		handler.acceptText(completed, true);

		verify(callTranscriptService).saveIfAbsent(
			CALL_SESSION_ID,
			SpeakerType.USER,
			"안녕하세요.",
			1,
			"user-1"
		);
	}

	@Test
	void continuesAfterMalformedJsonAndStorageFailure() {
		when(callTranscriptService.saveIfAbsent(anyLong(), any(), anyString(), anyInt(), anyString()))
			.thenThrow(new IllegalStateException("첫 저장 실패"))
			.thenReturn(true);
		handler.acceptText("{invalid-json", true);
		handler.acceptText("", true);
		handler.acceptText("null", true);
		handler.acceptText(itemAdded("user-1", "user"), true);
		handler.acceptText(itemAdded("assistant-1", "assistant"), true);

		handler.acceptText(userTranscriptCompleted("event-1", "user-1", "안녕하세요."), true);
		handler.acceptText(assistantTranscriptDone("event-2", "assistant-1", "반가워요."), true);

		verify(callTranscriptService).saveIfAbsent(
			CALL_SESSION_ID,
			SpeakerType.ASSISTANT,
			"반가워요.",
			2,
			"assistant-1"
		);
	}

	@Test
	void isolatesSequenceStateBetweenHandlers() {
		SidebandTranscriptHandler otherHandler = new SidebandTranscriptHandler(
			2L,
			new ObjectMapper(),
			callTranscriptService
		);
		handler.acceptText(itemAdded("item-1", "user"), true);
		otherHandler.acceptText(itemAdded("item-1", "user"), true);

		handler.acceptText(userTranscriptCompleted("event-1", "item-1", "첫 통화"), true);
		otherHandler.acceptText(userTranscriptCompleted("event-2", "item-1", "둘째 통화"), true);

		verify(callTranscriptService).saveIfAbsent(
			CALL_SESSION_ID,
			SpeakerType.USER,
			"첫 통화",
			1,
			"item-1"
		);
		verify(callTranscriptService).saveIfAbsent(
			2L,
			SpeakerType.USER,
			"둘째 통화",
			1,
			"item-1"
		);
	}

	@Test
	void ignoresEventsAfterClose() {
		handler.acceptText(itemAdded("user-1", "user"), true);

		handler.close();
		handler.acceptText(userTranscriptCompleted("event-1", "user-1", "안녕하세요."), true);

		verify(callTranscriptService, never()).saveIfAbsent(
			anyLong(),
			any(SpeakerType.class),
			anyString(),
			anyInt(),
			anyString()
		);
	}

	private String itemAdded(String itemId, String role) {
		return """
			{
			  "type":"conversation.item.added",
			  "item":{"id":"%s","type":"message","role":"%s"}
			}
			""".formatted(itemId, role);
	}

	private String userTranscriptCompleted(String eventId, String itemId, String transcript) {
		return completedTranscript(
			"conversation.item.input_audio_transcription.completed",
			eventId,
			itemId,
			transcript
		);
	}

	private String assistantTranscriptDone(String eventId, String itemId, String transcript) {
		return completedTranscript(
			"response.output_audio_transcript.done",
			eventId,
			itemId,
			transcript
		);
	}

	private String completedTranscript(String type, String eventId, String itemId, String transcript) {
		return """
			{
			  "type":"%s",
			  "event_id":"%s",
			  "item_id":"%s",
			  "transcript":"%s"
			}
			""".formatted(type, eventId, itemId, transcript);
	}
}
