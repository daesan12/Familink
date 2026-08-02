package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.call.config.OpenAiRealtimeProperties;

class OpenAiRealtimeGatewayTest {

	private MockRestServiceServer server;
	private OpenAiRealtimeGateway gateway;

	@BeforeEach
	void setUp() {
		RestClient.Builder builder = RestClient.builder().baseUrl("https://api.openai.test");
		server = MockRestServiceServer.bindTo(builder).build();
		OpenAiRealtimeProperties properties = new OpenAiRealtimeProperties();
		properties.setApiKey("test-key");
		properties.setModel("gpt-realtime-2");
		gateway = new OpenAiRealtimeGateway(builder.build(), properties, new ObjectMapper());
	}

	@Test
	void createsRealtimeCallAndExtractsCallId() {
		server.expect(requestTo("https://api.openai.test/v1/realtime/calls"))
			.andExpect(method(HttpMethod.POST))
			.andExpect(header("Authorization", "Bearer test-key"))
			.andExpect(header("OpenAI-Safety-Identifier", org.hamcrest.Matchers.hasLength(64)))
			.andExpect(content().string(containsString(
				"\"transcription\":{\"model\":\"gpt-transcribe\",\"languages\":[\"ko\"]}"
			)))
			.andExpect(content().string(containsString(
				"\"name\":\"get_person_recent_post_summaries\""
			)))
			.andExpect(content().string(containsString(
				"\"required\":[\"person_key\"],\"additionalProperties\":false"
			)))
			.andExpect(content().string(containsString("\"name\":\"get_calendar_events_by_date\"")))
			.andExpect(content().string(containsString("\"required\":[\"date_expression\"],\"additionalProperties\":false")))
			.andExpect(content().string(containsString("\"tool_choice\":\"auto\"")))
			.andRespond(withSuccess("v=0\r\ns=openai\r\n", MediaType.parseMediaType("application/sdp"))
				.header("Location", "/v1/realtime/calls/rtc_test_123"));

		OpenAiCall call = gateway.createCall(
			"v=0\r\ns=browser\r\n",
			new PersonaCatalog().get(1L),
			"테스트 프롬프트",
			10L
		);

		assertThat(call.callId()).isEqualTo("rtc_test_123");
		assertThat(call.sdpAnswer()).startsWith("v=0");
		server.verify();
	}

	@Test
	void rejectsOpenAiErrorResponse() {
		server.expect(requestTo("https://api.openai.test/v1/realtime/calls"))
			.andRespond(withStatus(HttpStatus.BAD_REQUEST));

		assertThatThrownBy(() -> gateway.createCall(
			"v=0\r\n",
			new PersonaCatalog().get(1L),
			"테스트 프롬프트",
			10L
		)).isInstanceOf(OpenAiRealtimeException.class);
	}
}
