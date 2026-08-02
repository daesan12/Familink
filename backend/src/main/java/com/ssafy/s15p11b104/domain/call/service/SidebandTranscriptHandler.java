package com.ssafy.s15p11b104.domain.call.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StringUtils;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.call.entity.SpeakerType;

final class SidebandTranscriptHandler {

	private static final Logger LOGGER = LoggerFactory.getLogger(SidebandTranscriptHandler.class);
	private static final String ITEM_ADDED = "conversation.item.added";
	private static final String INPUT_TRANSCRIPT_COMPLETED =
		"conversation.item.input_audio_transcription.completed";
	private static final String INPUT_TRANSCRIPT_FAILED =
		"conversation.item.input_audio_transcription.failed";
	private static final String OUTPUT_TRANSCRIPT_DONE = "response.output_audio_transcript.done";

	private final Long callSessionId;
	private final ObjectMapper objectMapper;
	private final CallTranscriptService callTranscriptService;
	private final StringBuilder textBuffer = new StringBuilder();

	private boolean integrityFailure;
	private boolean fragmentedTextOpen;
	private boolean closed;

	SidebandTranscriptHandler(
		Long callSessionId,
		ObjectMapper objectMapper,
		CallTranscriptService callTranscriptService
	) {
		this.callSessionId = callSessionId;
		this.objectMapper = objectMapper;
		this.callTranscriptService = callTranscriptService;
	}

	synchronized void acceptText(CharSequence data, boolean last) {
		if (closed) {
			return;
		}

		textBuffer.append(data);
		if (!last) {
			fragmentedTextOpen = true;
			return;
		}

		String eventJson = textBuffer.toString();
		textBuffer.setLength(0);
		fragmentedTextOpen = false;
		handleEvent(eventJson);
	}

	synchronized boolean hasIntegrityFailure() {
		return integrityFailure;
	}

	synchronized void close() {
		if (closed) {
			return;
		}

		boolean truncatedTextMessage = fragmentedTextOpen;
		closed = true;
		textBuffer.setLength(0);
		fragmentedTextOpen = false;
		if (truncatedTextMessage) {
			failClosed(null, "TRUNCATED_TEXT_MESSAGE");
		}
	}

	private void handleEvent(String eventJson) {
		JsonNode event;
		try {
			event = objectMapper.readTree(eventJson);
		} catch (JsonProcessingException exception) {
			LOGGER.warn(
				"Sideband 이벤트 JSON을 파싱하지 못했습니다. callSessionId={}, errorType={}",
				callSessionId,
				exception.getClass().getSimpleName()
			);
			failClosed(null, "MALFORMED_EVENT");
			return;
		}
		if (event == null || !event.isObject()) {
			LOGGER.warn("Sideband 이벤트가 JSON 객체가 아닙니다. callSessionId={}", callSessionId);
			failClosed(null, "NON_OBJECT_EVENT");
			return;
		}

		String eventType = textValue(event, "type");
		if (ITEM_ADDED.equals(eventType)) {
			reserveItem(event);
			return;
		}
		if (INPUT_TRANSCRIPT_COMPLETED.equals(eventType)) {
			completeTranscript(event, SpeakerType.USER);
			return;
		}
		if (OUTPUT_TRANSCRIPT_DONE.equals(eventType)) {
			completeTranscript(event, SpeakerType.ASSISTANT);
			return;
		}
		if (INPUT_TRANSCRIPT_FAILED.equals(eventType)) {
			handleFailedTranscript(event);
		}
	}

	private void reserveItem(JsonNode event) {
		JsonNode item = event.path("item");
		if (!"message".equals(textValue(item, "type"))) {
			return;
		}

		SpeakerType speaker = speakerFromRole(textValue(item, "role"));
		String itemId = textValue(item, "id");
		if (speaker == null || !StringUtils.hasText(itemId)) {
			failClosed(itemId, "INVALID_TRANSCRIPT_RESERVATION");
			return;
		}

		try {
			if (callTranscriptService.reserveItem(callSessionId, speaker, itemId) == null) {
				integrityFailure = true;
			}
		} catch (RuntimeException exception) {
			LOGGER.error(
				"Sideband 전사 예약을 저장하지 못했습니다. callSessionId={}, itemId={}, errorType={}",
				callSessionId,
				itemId,
				exception.getClass().getSimpleName()
			);
			failClosed(itemId, "RESERVATION_PERSISTENCE_FAILED");
		}
	}

	private void completeTranscript(JsonNode event, SpeakerType speaker) {
		String eventId = textValue(event, "event_id");
		String itemId = textValue(event, "item_id");
		if (!StringUtils.hasText(itemId)) {
			LOGGER.warn(
				"Sideband 완료 전사에 item_id가 없습니다. callSessionId={}, eventId={}",
				callSessionId,
				eventId
			);
			failClosed(null, "MISSING_COMPLETION_ITEM_ID");
			return;
		}

		try {
			callTranscriptService.completeItem(
				callSessionId,
				speaker,
				itemId,
				textValue(event, "transcript")
			);
		} catch (RuntimeException exception) {
			LOGGER.error(
				"Sideband 완료 전사를 처리하지 못했습니다. callSessionId={}, eventId={}, itemId={}, errorType={}",
				callSessionId,
				eventId,
				itemId,
				exception.getClass().getSimpleName()
			);
			failClosed(itemId, "COMPLETION_PERSISTENCE_FAILED");
		}
	}

	private void handleFailedTranscript(JsonNode event) {
		String eventId = textValue(event, "event_id");
		String itemId = textValue(event, "item_id");
		LOGGER.warn(
			"사용자 음성 전사가 실패했습니다. callSessionId={}, eventId={}, itemId={}",
			callSessionId,
			eventId,
			itemId
		);
		failClosed(itemId, "PROVIDER_TRANSCRIPTION_FAILED");
	}

	private void failClosed(String itemId, String failureCode) {
		integrityFailure = true;
		try {
			if (StringUtils.hasText(itemId)) {
				callTranscriptService.failItem(callSessionId, itemId, failureCode);
			} else {
				callTranscriptService.failSession(callSessionId, failureCode);
			}
		} catch (RuntimeException exception) {
			LOGGER.error(
				"전사 fail-closed 상태를 저장하지 못했습니다. callSessionId={}, errorType={}",
				callSessionId,
				exception.getClass().getSimpleName()
			);
		}
	}

	private SpeakerType speakerFromRole(String role) {
		if ("user".equals(role)) {
			return SpeakerType.USER;
		}
		if ("assistant".equals(role)) {
			return SpeakerType.ASSISTANT;
		}
		return null;
	}

	private String textValue(JsonNode node, String fieldName) {
		if (node == null) {
			return null;
		}
		JsonNode value = node.get(fieldName);
		if (value == null || !value.isTextual()) {
			return null;
		}
		return value.textValue();
	}
}
