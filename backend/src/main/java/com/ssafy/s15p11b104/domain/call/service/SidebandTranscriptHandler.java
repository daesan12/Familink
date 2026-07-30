package com.ssafy.s15p11b104.domain.call.service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

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
	private final Map<String, TranscriptReservation> reservations = new HashMap<>();
	private final Set<String> processedItemIds = new HashSet<>();

	private int nextSequence = 1;
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
			return;
		}

		String eventJson = textBuffer.toString();
		textBuffer.setLength(0);
		handleEvent(eventJson);
	}

	synchronized void close() {
		closed = true;
		textBuffer.setLength(0);
		reservations.clear();
		processedItemIds.clear();
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
			return;
		}
		if (event == null || !event.isObject()) {
			LOGGER.warn("Sideband 이벤트가 JSON 객체가 아닙니다. callSessionId={}", callSessionId);
			return;
		}

		String eventType = textValue(event, "type");
		if (ITEM_ADDED.equals(eventType)) {
			reserveSequence(event);
			return;
		}
		if (INPUT_TRANSCRIPT_COMPLETED.equals(eventType)) {
			saveCompletedTranscript(event, SpeakerType.USER);
			return;
		}
		if (OUTPUT_TRANSCRIPT_DONE.equals(eventType)) {
			saveCompletedTranscript(event, SpeakerType.ASSISTANT);
			return;
		}
		if (INPUT_TRANSCRIPT_FAILED.equals(eventType)) {
			handleFailedTranscript(event);
		}
	}

	private void reserveSequence(JsonNode event) {
		JsonNode item = event.path("item");
		if (!"message".equals(textValue(item, "type"))) {
			return;
		}

		SpeakerType speaker = speakerFromRole(textValue(item, "role"));
		String itemId = textValue(item, "id");
		if (speaker == null || !StringUtils.hasText(itemId)) {
			return;
		}
		if (processedItemIds.contains(itemId) || reservations.containsKey(itemId)) {
			return;
		}

		reservations.put(itemId, new TranscriptReservation(speaker, nextSequence));
		nextSequence++;
	}

	private void saveCompletedTranscript(JsonNode event, SpeakerType eventSpeaker) {
		String eventId = textValue(event, "event_id");
		String itemId = textValue(event, "item_id");
		if (!StringUtils.hasText(itemId)) {
			LOGGER.warn(
				"Sideband 완료 전사에 item_id가 없습니다. callSessionId={}, eventId={}",
				callSessionId,
				eventId
			);
			return;
		}
		if (processedItemIds.contains(itemId)) {
			return;
		}

		TranscriptReservation reservation = reservations.get(itemId);
		if (reservation == null || reservation.speaker() != eventSpeaker) {
			LOGGER.warn(
				"Sideband 완료 전사의 순번 또는 화자를 확인할 수 없습니다. callSessionId={}, eventId={}, itemId={}",
				callSessionId,
				eventId,
				itemId
			);
			return;
		}

		String transcript = textValue(event, "transcript");
		if (!StringUtils.hasText(transcript)) {
			markProcessed(itemId);
			return;
		}

		try {
			callTranscriptService.saveIfAbsent(
				callSessionId,
				eventSpeaker,
				transcript,
				reservation.sequenceNumber(),
				itemId
			);
			markProcessed(itemId);
		} catch (RuntimeException exception) {
			LOGGER.error(
				"Sideband 완료 전사를 저장하지 못했습니다. "
					+ "callSessionId={}, eventId={}, itemId={}, errorType={}",
				callSessionId,
				eventId,
				itemId,
				exception.getClass().getSimpleName()
			);
		}
	}

	private void handleFailedTranscript(JsonNode event) {
		String eventId = textValue(event, "event_id");
		String itemId = textValue(event, "item_id");
		if (!StringUtils.hasText(itemId)) {
			return;
		}

		markProcessed(itemId);
		LOGGER.warn(
			"사용자 음성 전사가 실패했습니다. callSessionId={}, eventId={}, itemId={}",
			callSessionId,
			eventId,
			itemId
		);
	}

	private void markProcessed(String itemId) {
		reservations.remove(itemId);
		processedItemIds.add(itemId);
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

	private record TranscriptReservation(
		SpeakerType speaker,
		int sequenceNumber
	) {
	}
}
