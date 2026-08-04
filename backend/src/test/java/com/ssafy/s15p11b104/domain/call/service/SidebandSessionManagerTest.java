package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.function.BiConsumer;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.call.config.OpenAiRealtimeProperties;

@ExtendWith(MockitoExtension.class)
class SidebandSessionManagerTest {

	private static final long CALL_SESSION_ID = 1L;

	@Mock
	private HttpClient httpClient;

	@Mock
	private WebSocket.Builder webSocketBuilder;

	@Mock
	private WebSocket webSocket;

	@Mock
	private CallTranscriptService callTranscriptService;

	@Mock
	private AiCallPostToolService postToolService;

	@Mock
	private AiCallCalendarToolService calendarToolService;

	@Mock
	private BiConsumer<Long, Boolean> unexpectedDisconnectHandler;

	private ArgumentCaptor<WebSocket.Listener> listenerCaptor;
	private SidebandSessionManager manager;

	@BeforeEach
	void setUp() {
		OpenAiRealtimeProperties properties = new OpenAiRealtimeProperties();
		properties.setApiKey("test-key");
		when(httpClient.newWebSocketBuilder()).thenReturn(webSocketBuilder);
		when(webSocketBuilder.connectTimeout(any())).thenReturn(webSocketBuilder);
		when(webSocketBuilder.header(anyString(), anyString())).thenReturn(webSocketBuilder);
		listenerCaptor = ArgumentCaptor.forClass(WebSocket.Listener.class);
		when(webSocketBuilder.buildAsync(any(URI.class), listenerCaptor.capture()))
			.thenReturn(CompletableFuture.completedFuture(webSocket));
		manager = new SidebandSessionManager(
			httpClient,
			properties,
			new ObjectMapper(),
			callTranscriptService,
			postToolService,
			calendarToolService
		);
	}

	@Test
	void returnsTrueAfterExpectedNormalRemoteClose() {
		SidebandSessionManager.ClosingSideband closingSideband = connectAndClaimClose();
		listenerCaptor.getValue().onClose(webSocket, WebSocket.NORMAL_CLOSURE, "normal");

		assertThat(closingSideband.finishClose()).isTrue();
		verifyNoInteractions(unexpectedDisconnectHandler);
	}

	@Test
	void returnsFalseWhenSocketErrorsDuringExpectedClose() {
		SidebandSessionManager.ClosingSideband closingSideband = connectAndClaimClose();
		listenerCaptor.getValue().onError(webSocket, new IllegalStateException("sideband failed"));

		assertThat(closingSideband.finishClose()).isFalse();
		verifyNoInteractions(unexpectedDisconnectHandler);
	}

	@Test
	void returnsFalseAfterAbnormalRemoteClose() {
		SidebandSessionManager.ClosingSideband closingSideband = connectAndClaimClose();
		listenerCaptor.getValue().onClose(webSocket, 1011, "internal error");

		assertThat(closingSideband.finishClose()).isFalse();
		verifyNoInteractions(unexpectedDisconnectHandler);
	}

	@Test
	void grantsCloseOwnershipToOnlyOneClaim() {
		SidebandSessionManager.ClosingSideband closingSideband = connectAndClaimClose();

		assertThat(manager.claimClose(CALL_SESSION_ID)).isNull();
		listenerCaptor.getValue().onClose(webSocket, WebSocket.NORMAL_CLOSURE, "normal");
		assertThat(closingSideband.finishClose()).isTrue();
		verifyNoInteractions(unexpectedDisconnectHandler);
	}

	private SidebandSessionManager.ClosingSideband connectAndClaimClose() {
		manager.connect(
			CALL_SESSION_ID,
			"call-1",
			Map.of(),
			unexpectedDisconnectHandler
		);
		SidebandSessionManager.ClosingSideband closingSideband = manager.claimClose(CALL_SESSION_ID);
		assertThat(closingSideband).isNotNull();
		assertThat(closingSideband.callId()).isEqualTo("call-1");
		return closingSideband;
	}
}
