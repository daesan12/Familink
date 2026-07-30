package com.ssafy.s15p11b104.domain.call.service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.LongConsumer;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.call.config.OpenAiRealtimeProperties;

@Component
public class SidebandSessionManager {

	private final HttpClient httpClient;
	private final OpenAiRealtimeProperties properties;
	private final ObjectMapper objectMapper;
	private final CallTranscriptService callTranscriptService;
	private final AiCallPostToolService postToolService;
	private final Map<Long, ManagedSocket> sessions = new ConcurrentHashMap<>();

	public SidebandSessionManager(
		HttpClient openAiSidebandHttpClient,
		OpenAiRealtimeProperties properties,
		ObjectMapper objectMapper,
		CallTranscriptService callTranscriptService,
		AiCallPostToolService postToolService
	) {
		this.httpClient = openAiSidebandHttpClient;
		this.properties = properties;
		this.objectMapper = objectMapper;
		this.callTranscriptService = callTranscriptService;
		this.postToolService = postToolService;
	}

	public void connect(
		Long sessionId,
		String callId,
		Map<String, AiCallPersonReference> personReferences,
		LongConsumer unexpectedDisconnectHandler
	) {
		if (!StringUtils.hasText(properties.getApiKey())) {
			throw new OpenAiRealtimeException("OPENAI_API_KEY가 설정되지 않았습니다.");
		}

		ManagedSocket managedSocket = new ManagedSocket(
			sessionId,
			callId,
			personReferences,
			unexpectedDisconnectHandler
		);
		ManagedSocket previous = sessions.put(sessionId, managedSocket);
		if (previous != null) {
			previous.close();
		}
		URI uri = URI.create(properties.getSidebandUrl()
			+ "?call_id="
			+ URLEncoder.encode(callId, StandardCharsets.UTF_8));
		try {
			WebSocket webSocket = httpClient.newWebSocketBuilder()
				.connectTimeout(properties.getConnectTimeout())
				.header("Authorization", "Bearer " + properties.getApiKey())
				.buildAsync(uri, managedSocket)
				.get(properties.getConnectTimeout().toMillis(), TimeUnit.MILLISECONDS);
			managedSocket.attach(webSocket);
			if (managedSocket.isDisconnected()) {
				throw new OpenAiRealtimeException("OpenAI Sideband 연결 직후 연결이 종료되었습니다.");
			}
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			sessions.remove(sessionId, managedSocket);
			managedSocket.close();
			throw new OpenAiRealtimeException("OpenAI Sideband 연결에 실패했습니다.", exception);
		} catch (Exception exception) {
			sessions.remove(sessionId, managedSocket);
			managedSocket.close();
			throw new OpenAiRealtimeException("OpenAI Sideband 연결에 실패했습니다.", exception);
		}
	}

	public String close(Long sessionId) {
		ManagedSocket managedSocket = sessions.remove(sessionId);
		if (managedSocket == null) {
			return null;
		}
		managedSocket.close();
		return managedSocket.callId();
	}

	private final class ManagedSocket implements WebSocket.Listener {

		private final String callId;
		private final LongConsumer unexpectedDisconnectHandler;
		private final AtomicBoolean closedByServer = new AtomicBoolean();
		private final AtomicBoolean disconnected = new AtomicBoolean();
		private final Long sessionId;
		private final SidebandTranscriptHandler transcriptHandler;
		private final SidebandToolHandler toolHandler;
		private volatile WebSocket webSocket;

		private ManagedSocket(
			Long sessionId,
			String callId,
			Map<String, AiCallPersonReference> personReferences,
			LongConsumer unexpectedDisconnectHandler
		) {
			this.sessionId = sessionId;
			this.callId = callId;
			this.unexpectedDisconnectHandler = unexpectedDisconnectHandler;
			this.transcriptHandler = new SidebandTranscriptHandler(
				sessionId,
				objectMapper,
				callTranscriptService
			);
			this.toolHandler = new SidebandToolHandler(
				sessionId,
				personReferences,
				objectMapper,
				postToolService
			);
		}

		private void attach(WebSocket webSocket) {
			this.webSocket = webSocket;
		}

		private String callId() {
			return callId;
		}

		private boolean isDisconnected() {
			return disconnected.get();
		}

		private void close() {
			closedByServer.set(true);
			transcriptHandler.close();
			toolHandler.close();
			WebSocket socket = webSocket;
			if (socket != null) {
				socket.sendClose(WebSocket.NORMAL_CLOSURE, "server end");
			}
		}

		@Override
		public void onOpen(WebSocket webSocket) {
			webSocket.request(1);
		}

		@Override
		public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
			List<String> clientEvents = List.of();
			if (!closedByServer.get() && !disconnected.get()) {
				transcriptHandler.acceptText(data, last);
				clientEvents = toolHandler.acceptText(data, last);
			}
			if (clientEvents.isEmpty()) {
				if (!closedByServer.get() && !disconnected.get()) {
					webSocket.request(1);
				}
				return null;
			}

			CompletionStage<WebSocket> sendStage = CompletableFuture.completedFuture(webSocket);
			for (String clientEvent : clientEvents) {
				sendStage = sendStage.thenCompose(socket -> socket.sendText(clientEvent, true));
			}
			return sendStage.handle((socket, error) -> {
				if (error != null) {
					handleUnexpectedDisconnect();
				} else if (!closedByServer.get() && !disconnected.get()) {
					webSocket.request(1);
				}
				return null;
			});
		}

		@Override
		public CompletionStage<?> onBinary(WebSocket webSocket, ByteBuffer data, boolean last) {
			webSocket.request(1);
			return null;
		}

		@Override
		public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
			handleUnexpectedDisconnect();
			return null;
		}

		@Override
		public void onError(WebSocket webSocket, Throwable error) {
			handleUnexpectedDisconnect();
		}

		private void handleUnexpectedDisconnect() {
			disconnected.set(true);
			transcriptHandler.close();
			toolHandler.close();
			if (closedByServer.get()) {
				return;
			}
			Long currentSessionId = sessionId;
			if (currentSessionId != null && sessions.remove(currentSessionId, this)) {
				unexpectedDisconnectHandler.accept(currentSessionId);
			}
		}
	}
}
