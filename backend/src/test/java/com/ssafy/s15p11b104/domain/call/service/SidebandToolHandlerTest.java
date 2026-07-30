package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class SidebandToolHandlerTest {

	private static final long CALL_SESSION_ID = 1L;
	private static final AiCallPersonReference FIRST_REFERENCE =
		new AiCallPersonReference(10L, "민지", "큰딸");
	private static final AiCallPersonReference SECOND_REFERENCE =
		new AiCallPersonReference(11L, "준호", "손자");

	@Mock
	private AiCallPostToolService postToolService;

	private ObjectMapper objectMapper;
	private SidebandToolHandler handler;

	@BeforeEach
	void setUp() {
		objectMapper = new ObjectMapper();
		Map<String, AiCallPersonReference> references = new LinkedHashMap<>();
		references.put("person_1", FIRST_REFERENCE);
		references.put("person_2", SECOND_REFERENCE);
		handler = new SidebandToolHandler(CALL_SESSION_ID, references, objectMapper, postToolService);
	}

	@Test
	void reassemblesFunctionCallAndReturnsToolOutputBeforeResponseCreate() throws Exception {
		AiCallToolResult result = AiCallToolResult.success(
			"person_1",
			FIRST_REFERENCE,
			List.of("첫 번째 요약", "두 번째 요약")
		);
		when(postToolService.getRecentPostSummaries(CALL_SESSION_ID, "person_1", FIRST_REFERENCE))
			.thenReturn(result);
		String event = responseDone(functionCall(
			"call_1",
			"get_person_recent_post_summaries",
			"{\"person_key\":\"person_1\"}"
		));
		int split = event.length() / 2;

		assertThat(handler.acceptText(event.substring(0, split), false)).isEmpty();
		List<String> clientEvents = handler.acceptText(event.substring(split), true);

		assertThat(clientEvents).hasSize(2);
		assertThat(clientEvents.get(1)).isEqualTo("{\"type\":\"response.create\"}");
		JsonNode output = toolOutput(clientEvents.getFirst());
		assertThat(output.path("status").asText()).isEqualTo("SUCCESS");
		assertThat(output.path("person_key").asText()).isEqualTo("person_1");
		assertThat(output.path("name").asText()).isEqualTo("민지");
		assertThat(output.path("display_name").asText()).isEqualTo("큰딸");
		assertThat(output.path("summaries"))
			.extracting(JsonNode::asText)
			.containsExactly("첫 번째 요약", "두 번째 요약");
		assertThat(clientEvents.getFirst()).doesNotContain("groupMemberId", "10");
		verify(postToolService).getRecentPostSummaries(CALL_SESSION_ID, "person_1", FIRST_REFERENCE);
	}

	@Test
	void processesMultipleCallsOnceAndCreatesOneFollowUpResponse() {
		when(postToolService.getRecentPostSummaries(CALL_SESSION_ID, "person_1", FIRST_REFERENCE))
			.thenReturn(AiCallToolResult.success("person_1", FIRST_REFERENCE, List.of("민지 요약")));
		when(postToolService.getRecentPostSummaries(CALL_SESSION_ID, "person_2", SECOND_REFERENCE))
			.thenReturn(AiCallToolResult.success("person_2", SECOND_REFERENCE, List.of("준호 요약")));
		String event = responseDone(
			functionCall(
				"call_1",
				"get_person_recent_post_summaries",
				"{\"person_key\":\"person_1\"}"
			),
			functionCall(
				"call_2",
				"get_person_recent_post_summaries",
				"{\"person_key\":\"person_2\"}"
			)
		);

		List<String> clientEvents = handler.acceptText(event, true);

		assertThat(clientEvents).hasSize(3);
		assertThat(clientEvents.getLast()).isEqualTo("{\"type\":\"response.create\"}");
		assertThat(handler.acceptText(event, true)).isEmpty();
	}

	@Test
	void returnsClarificationForInvalidArgumentsAndUnknownPersonKey() throws Exception {
		String event = responseDone(
			functionCall(
				"call_invalid",
				"get_person_recent_post_summaries",
				"{\"person_key\":\"person_1\",\"extra\":true}"
			),
			functionCall(
				"call_unknown",
				"get_person_recent_post_summaries",
				"{\"person_key\":\"person_99\"}"
			)
		);

		List<String> clientEvents = handler.acceptText(event, true);

		JsonNode invalidOutput = toolOutput(clientEvents.get(0));
		assertThat(invalidOutput.path("status").asText()).isEqualTo("NEEDS_CLARIFICATION");
		assertThat(invalidOutput.path("reason").asText()).isEqualTo("INVALID_ARGUMENTS");
		assertThat(invalidOutput.path("candidates")).hasSize(2);

		JsonNode unknownOutput = toolOutput(clientEvents.get(1));
		assertThat(unknownOutput.path("reason").asText()).isEqualTo("UNKNOWN_PERSON_KEY");
		assertThat(unknownOutput.path("candidates").get(0).path("name").asText()).isEqualTo("민지");
		assertThat(unknownOutput.toString()).doesNotContain("groupMemberId");
	}

	@Test
	void isolatesUnknownToolAndServiceFailureFromLaterEvents() throws Exception {
		when(postToolService.getRecentPostSummaries(CALL_SESSION_ID, "person_1", FIRST_REFERENCE))
			.thenThrow(new IllegalStateException("조회 실패"));
		String unknownToolEvent = responseDone(functionCall(
			"call_unknown_tool",
			"unknown_tool",
			"{\"person_key\":\"person_1\"}"
		));
		String failedServiceEvent = responseDone(functionCall(
			"call_failed",
			"get_person_recent_post_summaries",
			"{\"person_key\":\"person_1\"}"
		));

		JsonNode unknownToolOutput = toolOutput(handler.acceptText(unknownToolEvent, true).getFirst());
		JsonNode failedServiceOutput = toolOutput(handler.acceptText(failedServiceEvent, true).getFirst());

		assertThat(unknownToolOutput.path("status").asText()).isEqualTo("ERROR");
		assertThat(unknownToolOutput.path("reason").asText()).isEqualTo("UNKNOWN_TOOL");
		assertThat(failedServiceOutput.path("reason").asText()).isEqualTo("TEMPORARY_FAILURE");
	}

	@Test
	void ignoresEventsAfterClose() {
		handler.close();

		List<String> clientEvents = handler.acceptText(responseDone(functionCall(
			"call_1",
			"get_person_recent_post_summaries",
			"{\"person_key\":\"person_1\"}"
		)), true);

		assertThat(clientEvents).isEmpty();
	}

	@ParameterizedTest
	@ValueSource(strings = {"cancelled", "failed", "incomplete"})
	void ignoresToolCallsFromNonCompletedResponses(String responseStatus) {
		String response = responseDoneWithStatus(
			responseStatus,
			functionCall(
				"call_non_completed",
				"get_person_recent_post_summaries",
				"{\"person_key\":\"person_1\"}"
			)
		);

		assertThat(handler.acceptText(response, true)).isEmpty();
		verifyNoInteractions(postToolService);
	}

	@Test
	void ignoresToolCallsFromStatuslessResponses() {
		Map<String, Object> response = Map.of(
			"output",
			List.of(functionCall(
				"call_statusless_response",
				"get_person_recent_post_summaries",
				"{\"person_key\":\"person_1\"}"
			))
		);
		String event = writeJson(Map.of("type", "response.done", "response", response));

		assertThat(handler.acceptText(event, true)).isEmpty();
		verifyNoInteractions(postToolService);
	}

	@Test
	void ignoresIncompleteAndStatuslessFunctionCalls() {
		Map<String, Object> incompleteCall = functionCall(
			"call_incomplete",
			"get_person_recent_post_summaries",
			"{\"person_key\":\"person_1\"}"
		);
		incompleteCall.put("status", "incomplete");
		Map<String, Object> statuslessCall = functionCall(
			"call_statusless",
			"get_person_recent_post_summaries",
			"{\"person_key\":\"person_1\"}"
		);
		statuslessCall.remove("status");

		assertThat(handler.acceptText(responseDone(incompleteCall, statuslessCall), true)).isEmpty();
		verifyNoInteractions(postToolService);
	}

	private JsonNode toolOutput(String clientEvent) throws Exception {
		JsonNode event = objectMapper.readTree(clientEvent);
		assertThat(event.path("type").asText()).isEqualTo("conversation.item.create");
		assertThat(event.path("item").path("type").asText()).isEqualTo("function_call_output");
		return objectMapper.readTree(event.path("item").path("output").asText());
	}

	@SafeVarargs
	private final String responseDone(Map<String, Object>... outputItems) {
		return responseDoneWithStatus("completed", outputItems);
	}

	@SafeVarargs
	private final String responseDoneWithStatus(
		String status,
		Map<String, Object>... outputItems
	) {
		Map<String, Object> response = Map.of(
			"status", status,
			"output", List.of(outputItems)
		);
		Map<String, Object> event = Map.of("type", "response.done", "response", response);
		return writeJson(event);
	}

	private Map<String, Object> functionCall(String callId, String name, String arguments) {
		Map<String, Object> item = new LinkedHashMap<>();
		item.put("type", "function_call");
		item.put("call_id", callId);
		item.put("name", name);
		item.put("arguments", arguments);
		item.put("status", "completed");
		return item;
	}

	private String writeJson(Object value) {
		try {
			return objectMapper.writeValueAsString(value);
		} catch (Exception exception) {
			throw new IllegalStateException(exception);
		}
	}
}
