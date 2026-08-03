package com.ssafy.s15p11b104.domain.call.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.call.config.OpenAiRealtimeProperties;

@Component
public class OpenAiRealtimeGateway {

	private static final MediaType APPLICATION_SDP = MediaType.parseMediaType("application/sdp");

	private final RestClient restClient;
	private final OpenAiRealtimeProperties properties;
	private final ObjectMapper objectMapper;

	public OpenAiRealtimeGateway(
		RestClient openAiRealtimeRestClient,
		OpenAiRealtimeProperties properties,
		ObjectMapper objectMapper
	) {
		this.restClient = openAiRealtimeRestClient;
		this.properties = properties;
		this.objectMapper = objectMapper;
	}

	public OpenAiCall createCall(
		String sdpOffer,
		PersonaDefinition persona,
		String instructions,
		long careReceiverMemberId
	) {
		requireApiKey();
		MultipartBodyBuilder bodyBuilder = new MultipartBodyBuilder();
		bodyBuilder.part("sdp", sdpOffer).contentType(APPLICATION_SDP);
		bodyBuilder.part("session", createSessionJson(persona, instructions)).contentType(MediaType.APPLICATION_JSON);
		MultiValueMap<String, org.springframework.http.HttpEntity<?>> body = bodyBuilder.build();

		try {
			ResponseEntity<String> response = restClient.post()
				.uri("/v1/realtime/calls")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getApiKey())
				.header("OpenAI-Safety-Identifier", safetyIdentifier(careReceiverMemberId))
				.contentType(MediaType.MULTIPART_FORM_DATA)
				.body(body)
				.retrieve()
				.onStatus(status -> status.isError(), (request, failedResponse) -> {
					throw new OpenAiRealtimeException(
						"OpenAI Realtime 통화 생성이 HTTP " + failedResponse.getStatusCode().value() + "로 실패했습니다.");
				})
				.toEntity(String.class);

			String sdpAnswer = response.getBody();
			String location = response.getHeaders().getFirst(HttpHeaders.LOCATION);
			if (!StringUtils.hasText(sdpAnswer) || !StringUtils.hasText(location)) {
				throw new OpenAiRealtimeException("OpenAI Realtime 응답에 SDP 또는 call ID가 없습니다.");
			}
			return new OpenAiCall(extractCallId(location), sdpAnswer);
		} catch (OpenAiRealtimeException exception) {
			throw exception;
		} catch (RuntimeException exception) {
			throw new OpenAiRealtimeException("OpenAI Realtime 통화 생성 요청에 실패했습니다.", exception);
		}
	}

	public void hangUp(String callId) {
		if (!StringUtils.hasText(callId) || !StringUtils.hasText(properties.getApiKey())) {
			return;
		}
		try {
			restClient.post()
				.uri("/v1/realtime/calls/{callId}/hangup", callId)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getApiKey())
				.retrieve()
				.toBodilessEntity();
		} catch (RuntimeException ignored) {
			// 종료 API는 이미 접수되었으므로 OpenAI 정리는 best-effort로 처리한다.
		}
	}

	private String createSessionJson(PersonaDefinition persona, String instructions) {
		Map<String, Object> turnDetection = new LinkedHashMap<>();
		turnDetection.put("type", "server_vad");
		turnDetection.put("threshold", 0.8);
		turnDetection.put("interrupt_response", false);

		Map<String, Object> transcription = new LinkedHashMap<>();
		transcription.put("model", properties.getTranscriptionModel());
		transcription.put("languages", List.of(properties.getTranscriptionLanguage()));

		Map<String, Object> inputAudio = new LinkedHashMap<>();
		inputAudio.put("turn_detection", turnDetection);
		inputAudio.put("transcription", transcription);

		Map<String, Object> outputAudio = new LinkedHashMap<>();
		outputAudio.put("voice", persona.voice());

		Map<String, Object> audio = new LinkedHashMap<>();
		audio.put("input", inputAudio);
		audio.put("output", outputAudio);

		Map<String, Object> reasoning = new LinkedHashMap<>();
		reasoning.put("effort", "low");

		Map<String, Object> personKeyProperty = new LinkedHashMap<>();
		personKeyProperty.put("type", "string");
		personKeyProperty.put("description", "세션 컨텍스트에 제공된 가족 구성원 식별 키");

		Map<String, Object> toolProperties = new LinkedHashMap<>();
		toolProperties.put("person_key", personKeyProperty);

		Map<String, Object> toolParameters = new LinkedHashMap<>();
		toolParameters.put("type", "object");
		toolParameters.put("properties", toolProperties);
		toolParameters.put("required", List.of("person_key"));
		toolParameters.put("additionalProperties", false);

		Map<String, Object> recentPostTool = new LinkedHashMap<>();
		recentPostTool.put("type", "function");
		recentPostTool.put("name", "get_person_recent_post_summaries");
		recentPostTool.put(
			"description",
			"현재 통화의 특정 가족 구성원이 작성한 최근 분석 완료 게시글 요약을 조회합니다."
		);
		recentPostTool.put("parameters", toolParameters);

		Map<String, Object> dateExpressionProperty = new LinkedHashMap<>();
		dateExpressionProperty.put("type", "string");
		dateExpressionProperty.put("description", "사용자가 말한 원문 날짜 표현");

		Map<String, Object> calendarToolProperties = new LinkedHashMap<>();
		calendarToolProperties.put("date_expression", dateExpressionProperty);

		Map<String, Object> calendarToolParameters = new LinkedHashMap<>();
		calendarToolParameters.put("type", "object");
		calendarToolParameters.put("properties", calendarToolProperties);
		calendarToolParameters.put("required", List.of("date_expression"));
		calendarToolParameters.put("additionalProperties", false);

		Map<String, Object> calendarTool = new LinkedHashMap<>();
		calendarTool.put("type", "function");
		calendarTool.put("name", "get_calendar_events_by_date");
		calendarTool.put(
			"description",
			"Asia/Seoul 기준 특정 하루와 겹치는 현재 그룹의 모든 일정을 조회합니다."
		);
		calendarTool.put("parameters", calendarToolParameters);

		Map<String, Object> session = new LinkedHashMap<>();
		session.put("type", "realtime");
		session.put("model", properties.getModel());
		session.put("instructions", instructions);
		session.put("output_modalities", List.of("audio"));
		session.put("audio", audio);
		session.put("reasoning", reasoning);
		session.put("tools", List.of(recentPostTool, calendarTool));
		session.put("tool_choice", "auto");

		try {
			return objectMapper.writeValueAsString(session);
		} catch (JsonProcessingException exception) {
			throw new OpenAiRealtimeException("OpenAI Realtime 세션 설정을 직렬화할 수 없습니다.", exception);
		}
	}

	private String extractCallId(String location) {
		int separator = location.lastIndexOf('/');
		String callId = separator >= 0 ? location.substring(separator + 1) : location;
		if (!StringUtils.hasText(callId)) {
			throw new OpenAiRealtimeException("OpenAI Realtime call ID가 올바르지 않습니다.");
		}
		return callId;
	}

	private String safetyIdentifier(long careReceiverMemberId) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			byte[] hash = digest.digest(("ai-call:" + careReceiverMemberId).getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(hash);
		} catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", exception);
		}
	}

	private void requireApiKey() {
		if (!StringUtils.hasText(properties.getApiKey())) {
			throw new OpenAiRealtimeException("OPENAI_API_KEY가 설정되지 않았습니다.");
		}
	}
}
