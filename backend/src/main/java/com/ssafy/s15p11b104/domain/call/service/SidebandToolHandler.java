package com.ssafy.s15p11b104.domain.call.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StringUtils;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

final class SidebandToolHandler {

	private static final Logger LOGGER = LoggerFactory.getLogger(SidebandToolHandler.class);
	private static final String RESPONSE_DONE = "response.done";
	private static final String FUNCTION_CALL = "function_call";
	private static final String COMPLETED = "completed";
	private static final String RECENT_POST_TOOL = "get_person_recent_post_summaries";

	private final Long callSessionId;
	private final ObjectMapper objectMapper;
	private final AiCallPostToolService postToolService;
	private final StringBuilder textBuffer = new StringBuilder();
	private final Map<String, AiCallPersonReference> personReferences;
	private final Set<String> processedCallIds = new HashSet<>();

	private boolean closed;

	SidebandToolHandler(
		Long callSessionId,
		Map<String, AiCallPersonReference> personReferences,
		ObjectMapper objectMapper,
		AiCallPostToolService postToolService
	) {
		this.callSessionId = callSessionId;
		this.personReferences = new LinkedHashMap<>(personReferences);
		this.objectMapper = objectMapper;
		this.postToolService = postToolService;
	}

	synchronized List<String> acceptText(CharSequence data, boolean last) {
		if (closed) {
			return List.of();
		}

		textBuffer.append(data);
		if (!last) {
			return List.of();
		}

		String eventJson = textBuffer.toString();
		textBuffer.setLength(0);
		return handleEvent(eventJson);
	}

	synchronized void close() {
		closed = true;
		textBuffer.setLength(0);
		personReferences.clear();
		processedCallIds.clear();
	}

	private List<String> handleEvent(String eventJson) {
		JsonNode event;
		try {
			event = objectMapper.readTree(eventJson);
		} catch (JsonProcessingException exception) {
			return List.of();
		}
		if (event == null || !event.isObject() || !RESPONSE_DONE.equals(textValue(event, "type"))) {
			return List.of();
		}

		JsonNode response = event.path("response");
		if (!COMPLETED.equals(textValue(response, "status"))) {
			return List.of();
		}

		JsonNode output = response.path("output");
		if (!output.isArray()) {
			return List.of();
		}

		List<String> clientEvents = new ArrayList<>();
		for (JsonNode item : output) {
			if (!FUNCTION_CALL.equals(textValue(item, "type"))
				|| !COMPLETED.equals(textValue(item, "status"))) {
				continue;
			}
			String clientEvent = handleFunctionCall(item);
			if (clientEvent != null) {
				clientEvents.add(clientEvent);
			}
		}
		if (!clientEvents.isEmpty()) {
			clientEvents.add(responseCreateEvent());
		}
		return List.copyOf(clientEvents);
	}

	private String handleFunctionCall(JsonNode item) {
		String callId = textValue(item, "call_id");
		if (!StringUtils.hasText(callId)) {
			LOGGER.warn("Sideband Tool 호출에 call_id가 없습니다. callSessionId={}", callSessionId);
			return null;
		}
		if (processedCallIds.contains(callId)) {
			return null;
		}

		AiCallToolResult result = executeTool(item, callId);
		try {
			String clientEvent = functionCallOutputEvent(callId, result);
			processedCallIds.add(callId);
			return clientEvent;
		} catch (JsonProcessingException exception) {
			LOGGER.error(
				"Sideband Tool 결과를 직렬화하지 못했습니다. callSessionId={}, callId={}, errorType={}",
				callSessionId,
				callId,
				exception.getClass().getSimpleName()
			);
			return null;
		}
	}

	private AiCallToolResult executeTool(JsonNode item, String callId) {
		String toolName = textValue(item, "name");
		if (!RECENT_POST_TOOL.equals(toolName)) {
			return AiCallToolResult.error(AiCallToolResult.Reason.UNKNOWN_TOOL);
		}

		String personKey = parsePersonKey(textValue(item, "arguments"));
		if (!StringUtils.hasText(personKey)) {
			return AiCallToolResult.needsClarification(
				AiCallToolResult.Reason.INVALID_ARGUMENTS,
				candidates()
			);
		}

		AiCallPersonReference reference = personReferences.get(personKey);
		if (reference == null) {
			return AiCallToolResult.needsClarification(
				AiCallToolResult.Reason.UNKNOWN_PERSON_KEY,
				candidates()
			);
		}

		try {
			return postToolService.getRecentPostSummaries(callSessionId, personKey, reference);
		} catch (RuntimeException exception) {
			LOGGER.error(
				"가족 게시글 Tool 조회에 실패했습니다. callSessionId={}, callId={}, errorType={}",
				callSessionId,
				callId,
				exception.getClass().getSimpleName()
			);
			return AiCallToolResult.error(AiCallToolResult.Reason.TEMPORARY_FAILURE);
		}
	}

	private String parsePersonKey(String argumentsJson) {
		if (!StringUtils.hasText(argumentsJson)) {
			return null;
		}
		try {
			JsonNode arguments = objectMapper.readTree(argumentsJson);
			if (arguments == null || !arguments.isObject() || arguments.size() != 1) {
				return null;
			}
			return textValue(arguments, "person_key");
		} catch (JsonProcessingException exception) {
			return null;
		}
	}

	private List<AiCallToolResult.PersonCandidate> candidates() {
		return personReferences.entrySet().stream()
			.map(entry -> new AiCallToolResult.PersonCandidate(
				entry.getKey(),
				entry.getValue().name(),
				entry.getValue().displayName()
			))
			.toList();
	}

	private String functionCallOutputEvent(String callId, AiCallToolResult result) throws JsonProcessingException {
		Map<String, Object> item = new LinkedHashMap<>();
		item.put("type", "function_call_output");
		item.put("call_id", callId);
		item.put("output", objectMapper.writeValueAsString(result));

		Map<String, Object> event = new LinkedHashMap<>();
		event.put("type", "conversation.item.create");
		event.put("item", item);
		return objectMapper.writeValueAsString(event);
	}

	private String responseCreateEvent() {
		return "{\"type\":\"response.create\"}";
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
