package com.ssafy.s15p11b104.domain.call.service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BiConsumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.call.config.OpenAiRealtimeProperties;

@Component
public class SidebandSessionManager {

	private static final Logger LOGGER = LoggerFactory.getLogger(SidebandSessionManager.class);
	private static final long FINAL_EVENT_DRAIN_TIMEOUT_SECONDS = 2;
	private static final long CLOSE_CALLBACK_DISPATCH_TOLERANCE_MILLIS = 500;

	private final HttpClient httpClient;
	private final OpenAiRealtimeProperties properties;
	private final ObjectMapper objectMapper;
	private final CallTranscriptService callTranscriptService;
	private final AiCallPostToolService postToolService;
	private final AiCallCalendarToolService calendarToolService;
	private final Map<Long, ManagedSocket> sessions = new ConcurrentHashMap<>();

	public SidebandSessionManager(
		HttpClient openAiSidebandHttpClient,
		OpenAiRealtimeProperties properties,
		ObjectMapper objectMapper,
		CallTranscriptService callTranscriptService,
		AiCallPostToolService postToolService,
		AiCallCalendarToolService calendarToolService
	) {
		this.httpClient = openAiSidebandHttpClient;
		this.properties = properties;
		this.objectMapper = objectMapper;
		this.callTranscriptService = callTranscriptService;
		this.postToolService = postToolService;
		this.calendarToolService = calendarToolService;
	}

	public void connect(
		Long sessionId,
		String callId,
		Map<String, AiCallPersonReference> personReferences,
		BiConsumer<Long, Boolean> unexpectedDisconnectHandler
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

	public Set<Long> activeSessionIds() {
		return Set.copyOf(sessions.keySet());
	}

	/**
	 * 정상 종료할 세션의 소유권을 원자적으로 가져온다.
	 *
	 * <p>세션을 맵에서 제거하는 동시에 정상 종료 예정으로 표시하므로, 종료 요청이 여러 번
	 * 들어와도 한 요청만 핸들을 받는다. 소유권 없이 {@link ClosingSideband#finishClose()}를
	 * 나눠 호출하면 늦게 도착한 쪽이 drain 실패로 판정해 세션을 복구 불가능한 전사
	 * 무결성 상태로 만든다.
	 *
	 * @return 이 호출이 소유권을 가져갔으면 핸들, 이미 정리됐거나 없으면 {@code null}
	 */
	public ClosingSideband claimClose(Long sessionId) {
		ManagedSocket managedSocket = sessions.remove(sessionId);
		if (managedSocket == null) {
			return null;
		}
		managedSocket.expectClose();
		return new ClosingSideband(managedSocket);
	}

	/**
	 * 소유권을 가져온 Sideband 세션의 종료 절차를 수행하는 핸들이다.
	 */
	public static final class ClosingSideband {

		private final ManagedSocket managedSocket;

		private ClosingSideband(ManagedSocket managedSocket) {
			this.managedSocket = managedSocket;
		}

		public String callId() {
			return managedSocket.callId();
		}

		/**
		 * 남은 이벤트를 drain하고 소켓을 닫는다.
		 *
		 * @return remote 종료 callback을 관측하고 전사 무결성 실패가 없으면 {@code true}
		 */
		public boolean finishClose() {
			managedSocket.initiateCloseHandshake();
			RemoteTermination remoteTermination = managedSocket.awaitRemoteClose();
			boolean transcriptHealthy = !managedSocket.transcriptHandler.hasIntegrityFailure();
			managedSocket.close();
			boolean drained = remoteTermination.isCloseObserved() && transcriptHealthy;
			if (!drained) {
				LOGGER.warn(
					"Sideband 종료 drain 판정에 실패했습니다. callSessionId={}, callId={}, remoteTermination={}, transcriptHealthy={}",
					managedSocket.sessionId,
					managedSocket.callId,
					remoteTermination,
					transcriptHealthy
				);
			}
			return drained;
		}
	}

	private enum RemoteTermination {
		NORMAL_CLOSE,
		OTHER_CLOSE,
		ERROR,
		TIMEOUT,
		INTERRUPTED;

		private boolean isCloseObserved() {
			return this == NORMAL_CLOSE || this == OTHER_CLOSE;
		}
	}

	private final class ManagedSocket implements WebSocket.Listener {

		private final String callId;
		private final BiConsumer<Long, Boolean> unexpectedDisconnectHandler;
		private final AtomicBoolean closedByServer = new AtomicBoolean();
		private final AtomicBoolean closeFrameSent = new AtomicBoolean();
		private final AtomicBoolean closeExpected = new AtomicBoolean();
		private final AtomicBoolean disconnected = new AtomicBoolean();
		private final CompletableFuture<RemoteTermination> remoteCloseSignal = new CompletableFuture<>();
		private final Long sessionId;
		private final SidebandTranscriptHandler transcriptHandler;
		private final SidebandToolHandler toolHandler;
		private volatile WebSocket webSocket;

		private ManagedSocket(
			Long sessionId,
			String callId,
			Map<String, AiCallPersonReference> personReferences,
			BiConsumer<Long, Boolean> unexpectedDisconnectHandler
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
				postToolService,
				calendarToolService
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

		private void expectClose() {
			closeExpected.set(true);
		}

		private RemoteTermination awaitRemoteClose() {
			try {
				// 2초 drain 직후 JDK HttpClient가 onClose를 전달하는 스케줄링 지연만 흡수한다.
				long callbackTimeoutMillis = TimeUnit.SECONDS.toMillis(FINAL_EVENT_DRAIN_TIMEOUT_SECONDS)
					+ CLOSE_CALLBACK_DISPATCH_TOLERANCE_MILLIS;
				return remoteCloseSignal.get(callbackTimeoutMillis, TimeUnit.MILLISECONDS);
			} catch (InterruptedException exception) {
				Thread.currentThread().interrupt();
				return RemoteTermination.INTERRUPTED;
			} catch (ExecutionException exception) {
				return RemoteTermination.ERROR;
			} catch (TimeoutException exception) {
				return RemoteTermination.TIMEOUT;
			}
		}

		private void initiateCloseHandshake() {
			if (disconnected.get() || !closeFrameSent.compareAndSet(false, true)) {
				return;
			}
			WebSocket socket = webSocket;
			if (socket != null) {
				socket.sendClose(WebSocket.NORMAL_CLOSURE, "server end");
			}
		}

		private void close() {
			closedByServer.set(true);
			transcriptHandler.close();
			toolHandler.close();
			initiateCloseHandshake();
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
					handleDisconnect(RemoteTermination.ERROR);
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
			RemoteTermination termination = statusCode == WebSocket.NORMAL_CLOSURE
				? RemoteTermination.NORMAL_CLOSE
				: RemoteTermination.OTHER_CLOSE;
			LOGGER.info(
				"OpenAI Sideband가 종료되었습니다. callSessionId={}, callId={}, statusCode={}, reason={}",
				sessionId,
				callId,
				statusCode,
				reason
			);
			handleDisconnect(termination);
			return null;
		}

		@Override
		public void onError(WebSocket webSocket, Throwable error) {
			LOGGER.warn(
				"OpenAI Sideband 연결이 오류로 종료되었습니다. callSessionId={}, callId={}, errorType={}",
				sessionId,
				callId,
				error.getClass().getSimpleName()
			);
			handleDisconnect(RemoteTermination.ERROR);
		}

		private void handleDisconnect(RemoteTermination remoteTermination) {
			disconnected.set(true);
			transcriptHandler.close();
			toolHandler.close();
			remoteCloseSignal.complete(remoteTermination);
			if (closedByServer.get() || closeExpected.get()) {
				return;
			}
			Long currentSessionId = sessionId;
			if (currentSessionId != null && sessions.remove(currentSessionId, this)) {
				unexpectedDisconnectHandler.accept(
					currentSessionId,
					remoteTermination == RemoteTermination.NORMAL_CLOSE
						&& !transcriptHandler.hasIntegrityFailure()
				);
			}
		}
	}
}
