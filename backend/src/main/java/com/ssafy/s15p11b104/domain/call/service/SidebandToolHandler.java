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
	private static final String CALENDAR_TOOL = "get_calendar_events_by_date_range";
	private static final String START_DATE = "start_date";
	private static final String END_DATE = "end_date";
	private static final String PERSON_KEY = "person_key";

	private final Long callSessionId;
	private final ObjectMapper objectMapper;
	private final AiCallPostToolService postToolService;
	private final AiCallCalendarToolService calendarToolService;
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
		this(callSessionId, personReferences, objectMapper, postToolService, null);
	}

	SidebandToolHandler(
		Long callSessionId,
		Map<String, AiCallPersonReference> personReferences,
		ObjectMapper objectMapper,
		AiCallPostToolService postToolService,
		AiCallCalendarToolService calendarToolService
	) {
		this.callSessionId = callSessionId;
		this.personReferences = new LinkedHashMap<>(personReferences);
		this.objectMapper = objectMapper;
		this.postToolService = postToolService;
		this.calendarToolService = calendarToolService;
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
		if (CALENDAR_TOOL.equals(toolName)) {
			return executeCalendarTool(item, callId);
		}
		if (!RECENT_POST_TOOL.equals(toolName)) {
			return AiCallToolResult.error(AiCallToolResult.Reason.UNKNOWN_TOOL);
		}

		Map<String, String> arguments = parseArguments(textValue(item, "arguments"), List.of(PERSON_KEY));
		if (arguments == null) {
			return AiCallToolResult.needsClarification(
				AiCallToolResult.Reason.INVALID_ARGUMENTS,
				candidates()
			);
		}
		String personKey = arguments.get(PERSON_KEY);

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

	private AiCallToolResult executeCalendarTool(JsonNode item, String callId) {
		Map<String, String> arguments = parseArguments(
			textValue(item, "arguments"),
			List.of(START_DATE, END_DATE)
		);
		if (arguments == null) {
			return AiCallToolResult.needsClarification(AiCallToolResult.Reason.INVALID_ARGUMENTS);
		}
		if (calendarToolService == null) {
			return AiCallToolResult.error(AiCallToolResult.Reason.TEMPORARY_FAILURE);
		}

		try {
			return calendarToolService.getEventsByDateRange(
				callSessionId,
				arguments.get(START_DATE),
				arguments.get(END_DATE)
			);
		} catch (RuntimeException exception) {
			LOGGER.error(
				"일정 Tool 조회에 실패했습니다. callSessionId={}, callId={}, errorType={}",
				callSessionId,
				callId,
				exception.getClass().getSimpleName()
			);
			return AiCallToolResult.error(AiCallToolResult.Reason.TEMPORARY_FAILURE);
		}
	}

	/**
	 * 허용 필드 집합과 정확히 일치하는 문자열 인자만 통과시킨다. 초과 키, 누락 키,
	 * 문자열이 아닌 값은 모두 거부한다. 툴 스키마에 {@code strict}가 없어 모델이
	 * 스키마를 벗어난 인자를 보낼 수 있으므로 이 경계에서 다시 확인한다.
	 *
	 * @return 필드별 문자열 값. 형태가 어긋나면 {@code null}
	 */
	private Map<String, String> parseArguments(String argumentsJson, List<String> allowedFields) {
		if (!StringUtils.hasText(argumentsJson)) {
			return null;
		}
		JsonNode arguments;
		try {
			arguments = objectMapper.readTree(argumentsJson);
		} catch (JsonProcessingException exception) {
			return null;
		}
		if (arguments == null || !arguments.isObject() || arguments.size() != allowedFields.size()) {
			return null;
		}

		Map<String, String> parsed = new LinkedHashMap<>();
		for (String field : allowedFields) {
			String value = textValue(arguments, field);
			if (!StringUtils.hasText(value)) {
				return null;
			}
			parsed.put(field, value);
		}
		return parsed;
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
