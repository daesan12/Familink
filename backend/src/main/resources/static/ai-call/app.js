// 백엔드 PersonaCatalog의 ID·음성 매핑과 동일하게 유지한다.
const personas = [
	{ id: 1, name: "사랑스러운 아들", voice: "ash", initial: "아", description: "엄마·아빠라고 부르며 다정한 존댓말로 대화해요." },
	{ id: 2, name: "사랑스러운 딸", voice: "sage", initial: "딸", description: "엄마·아빠라고 부르며 세심한 존댓말로 대화해요." },
	{ id: 3, name: "남자 비서", voice: "cedar", initial: "비", description: "회장님·사모님이라고 부르며 격식 있게 보좌해요." },
	{ id: 4, name: "여자 비서", voice: "marin", initial: "서", description: "회장님·사모님이라고 부르며 세심하고 격식 있게 보좌해요." },
	{ id: 5, name: "친구 학수", voice: "verse", initial: "학", description: "친구처럼 반말과 자연스러운 경상도 사투리로 대화해요." },
	{ id: 6, name: "친구 복희", voice: "ballad", initial: "복", description: "친구처럼 반말과 자연스러운 전라도 사투리로 대화해요." },
];

const REPORT_POLL_INTERVAL_MS = 1000;
const REPORT_POLL_MAX_ATTEMPTS = 30;

// 화면 전환과 상태 갱신에 사용하는 DOM 요소를 시작 시 한 번만 조회한다.
const ui = {
	selectionScreen: document.querySelector("#selectionScreen"),
	callScreen: document.querySelector("#callScreen"),
	endedScreen: document.querySelector("#endedScreen"),
	personaGrid: document.querySelector("#personaGrid"),
	selectedPersonaDescription: document.querySelector("#selectedPersonaDescription"),
	startCallButton: document.querySelector("#startCallButton"),
	callerAvatar: document.querySelector("#callerAvatar"),
	callerName: document.querySelector("#callerName"),
	callStatus: document.querySelector("#callStatus"),
	turnLabel: document.querySelector("#turnLabel"),
	timer: document.querySelector("#timer"),
	captionHistory: document.querySelector("#captionHistory"),
	captionCurrent: document.querySelector("#captionCurrent"),
	speakerButton: document.querySelector("#speakerButton"),
	microphoneButton: document.querySelector("#microphoneButton"),
	endCallButton: document.querySelector("#endCallButton"),
	endedDuration: document.querySelector("#endedDuration"),
	endedMessage: document.querySelector("#endedMessage"),
	reportStatus: document.querySelector("#reportStatus"),
	reportSummary: document.querySelector("#reportSummary"),
	reportDetails: document.querySelector("#reportDetails"),
	reportEmotionCategory: document.querySelector("#reportEmotionCategory"),
	reportEmotionSubcategory: document.querySelector("#reportEmotionSubcategory"),
	reportGuardianMessage: document.querySelector("#reportGuardianMessage"),
	reportCreatedAt: document.querySelector("#reportCreatedAt"),
	reportRetryButton: document.querySelector("#reportRetryButton"),
	backButton: document.querySelector("#backButton"),
	remoteAudio: document.querySelector("#remoteAudio"),
	logEntries: document.querySelector("#logEntries"),
	logState: document.querySelector("#logState"),
	toast: document.querySelector("#toast"),
};

// 한 번의 통화에서 공유하는 브라우저 런타임 상태다.
// 서버에 저장되는 통화 상태와는 별개이며, 선택 화면 복귀나 새 통화 시작 시 초기화한다.
const call = {
	selectedPersonaId: 3,
	callSessionId: null,
	peerConnection: null,
	dataChannel: null,
	localStream: null,
	startedAt: null,
	timerId: null,
	durationSeconds: 0,
	connectionReported: false,
	ending: false,
	cancelRequested: false,
	sessionCreationPromise: null,
	microphoneOn: true,
	speakerOn: true,
	captionDraft: "",
	captionHistory: [],
	reportPollingRunId: 0,
};

// 페르소나 목록을 접근 가능한 radio 형태의 버튼으로 구성한다.
function renderPersonas() {
	ui.personaGrid.replaceChildren();
	for (const persona of personas) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "persona-card";
		button.role = "radio";
		button.dataset.personaId = String(persona.id);
		button.setAttribute("aria-checked", String(persona.id === call.selectedPersonaId));
		button.setAttribute("aria-label", `${persona.name}, 음성 ${persona.voice}`);
		button.innerHTML = `
			<span class="persona-avatar">${persona.initial}</span>
			<span class="persona-name">${persona.name}</span>
		`;
		button.addEventListener("click", () => selectPersona(persona.id));
		ui.personaGrid.append(button);
	}
	updateSelectedPersona();
}

function selectPersona(personaId) {
	call.selectedPersonaId = personaId;
	for (const card of ui.personaGrid.querySelectorAll(".persona-card")) {
		card.setAttribute("aria-checked", String(Number(card.dataset.personaId) === personaId));
	}
	updateSelectedPersona();
}

function updateSelectedPersona() {
	const persona = selectedPersona();
	ui.selectedPersonaDescription.textContent = `${persona.name}: ${persona.description}`;
}

function selectedPersona() {
	return personas.find((persona) => persona.id === call.selectedPersonaId);
}

async function startCall() {
	if (!navigator.mediaDevices?.getUserMedia) {
		showError("이 브라우저에서는 마이크를 사용할 수 없습니다.");
		return;
	}

	resetCallRuntime();
	showScreen("call");
	const persona = selectedPersona();
	ui.callerName.textContent = persona.name;
	ui.callerAvatar.textContent = persona.initial;
	setCallState("연결 준비 중", "마이크 사용 권한을 확인하고 있습니다");
	log("마이크 권한 요청");

	try {
		// 브라우저 기본 음성 보정 기능을 켠 마이크 스트림을 준비한다.
		call.localStream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
			},
		});
		throwIfCallCancelled();
		log("마이크 스트림 준비 완료");

		// 마이크 트랙은 WebRTC로 보내고, OpenAI의 원격 음성 트랙은 별도 이벤트로 받는다.
		call.peerConnection = new RTCPeerConnection();
		call.peerConnection.addEventListener("track", handleRemoteTrack);
		call.peerConnection.addEventListener("connectionstatechange", handleConnectionStateChange);
		for (const track of call.localStream.getTracks()) {
			call.peerConnection.addTrack(track, call.localStream);
		}

		// 음성과 별도로 Realtime 이벤트를 받아 AI 발화 자막과 화면 상태를 갱신한다.
		call.dataChannel = call.peerConnection.createDataChannel("oai-events");
		call.dataChannel.addEventListener("open", () => log("Realtime 이벤트 채널 연결"));
		call.dataChannel.addEventListener("message", handleRealtimeEvent);
		call.dataChannel.addEventListener("close", () => log("Realtime 이벤트 채널 종료"));

		// 브라우저가 만든 SDP offer를 서버에 보내고, OpenAI가 만든 answer를 돌려받는다.
		setCallState("연결 중", "WebRTC SDP를 교환하고 있습니다");
		const offer = await call.peerConnection.createOffer();
		await call.peerConnection.setLocalDescription(offer);
		throwIfCallCancelled();
		log("SDP offer 생성");

		// 연결 중 종료 버튼을 누를 수 있으므로 생성 요청 Promise를 보관해 종료 처리와 공유한다.
		call.sessionCreationPromise = createCallSession(persona.id, offer.sdp);
		const payload = await call.sessionCreationPromise;
		call.callSessionId = payload.call_session_id;
		call.sessionCreationPromise = null;
		log(`통화 세션 생성 #${call.callSessionId}`);
		throwIfCallCancelled();

		await call.peerConnection.setRemoteDescription({
			type: "answer",
			sdp: payload.sdp_answer,
		});
		throwIfCallCancelled();
		log("SDP answer 적용");

		// WebRTC 연결이 실제로 완료된 뒤에만 서버 세션을 IN_PROGRESS로 전환한다.
		await waitForConnected(call.peerConnection, 20_000);
		throwIfCallCancelled();
		await reportConnectionResult("CONNECTED");
		throwIfCallCancelled();
		if (isConnectionLost()) {
			await endAfterConnectionLoss();
			return;
		}
		beginTimer();
		setCallState("통화 중", "말씀하시면 AI가 답합니다");
		log("WebRTC 통화 연결 완료");
	} catch (error) {
		call.sessionCreationPromise = null;
		// 사용자가 연결을 취소한 경우에는 오류 화면을 띄우지 않고 로컬 자원만 정리한다.
		if (error instanceof CallCancelledError || call.cancelRequested) {
			cleanupMedia();
			return;
		}
		log(`연결 실패: ${safeErrorMessage(error)}`);
		await reportConnectionResult("FAILED", "WEBRTC_CONNECTION_FAILED");
		// 실패 결과를 기록하지 못했다면 종료 API라도 호출해 CONNECTING 세션이 남지 않게 한다.
		if (call.callSessionId && !call.connectionReported) {
			try {
				await requestCallEnd("CONNECTION_LOST");
			} catch (cleanupError) {
				log(`실패 세션 정리 실패: ${safeErrorMessage(cleanupError)}`);
			}
		}
		cleanupMedia();
		showScreen("selection");
		showError(safeErrorMessage(error));
	}
}

function handleRemoteTrack(event) {
	// OpenAI가 보낸 음성 스트림을 숨겨진 audio 요소에 연결해 재생한다.
	const [stream] = event.streams;
	if (stream) {
		ui.remoteAudio.srcObject = stream;
		ui.remoteAudio.play().catch(() => {
			log("원격 오디오 자동 재생 대기");
		});
	}
}

function handleConnectionStateChange() {
	const state = call.peerConnection?.connectionState;
	if (!state) {
		return;
	}
	log(`WebRTC 상태: ${state}`);
	// 통화 시작 후의 단절만 서버 종료 API로 정리한다. 연결 단계 실패는 startCall의 catch가 처리한다.
	if (isConnectionLost() && call.startedAt && !call.ending) {
		void endAfterConnectionLoss();
	}
}

function isConnectionLost() {
	const state = call.peerConnection?.connectionState;
	return state === "failed" || state === "disconnected";
}

async function endAfterConnectionLoss() {
	call.ending = true;
	call.cancelRequested = true;
	log("WebRTC 연결 단절 감지");
	try {
		await requestCallEnd("CONNECTION_LOST");
		finishLocally("연결이 종료되었습니다.");
	} catch (error) {
		log(`연결 단절 정리 실패: ${safeErrorMessage(error)}`);
		finishLocally("브라우저 연결은 종료했지만 서버 상태 확인이 필요합니다.");
	}
}

function handleRealtimeEvent(message) {
	// DataChannel 메시지는 OpenAI Realtime 이벤트 JSON이다.
	let event;
	try {
		event = JSON.parse(message.data);
	} catch {
		log("해석할 수 없는 Realtime 이벤트");
		return;
	}

	// 스트리밍 delta 이벤트는 초당 수십 건 도착해 로그 보관 한도를 잡아먹으므로 제외한다.
	// 각 delta에는 로그에 남는 done·completed 이벤트가 대응된다.
	if (event.type?.endsWith(".delta") !== true) {
		log(`Realtime: ${event.type}`);
	}

	// delta는 화면에 즉시 이어 붙이고, 완료 이벤트가 오면 하나의 확정 발화로 보관한다.
	if (event.type === "response.output_audio_transcript.delta") {
		call.captionDraft += event.delta ?? "";
		ui.captionCurrent.textContent = call.captionDraft;
		ui.turnLabel.textContent = "AI가 말하고 있습니다";
	}

	if (event.type === "response.output_audio_transcript.done") {
		const transcript = (event.transcript || call.captionDraft).trim();
		if (transcript) {
			call.captionHistory.push(transcript);
			call.captionHistory = call.captionHistory.slice(-3);
		}
		call.captionDraft = "";
		renderCaptions();
		ui.turnLabel.textContent = "말씀을 듣고 있습니다";
	}

	if (event.type === "input_audio_buffer.speech_started") {
		ui.turnLabel.textContent = "말씀을 듣고 있습니다";
	}

	if (event.type === "error") {
		const messageText = event.error?.message || "Realtime 처리 중 오류가 발생했습니다.";
		showError(messageText);
	}
}

function renderCaptions() {
	// 화면이 길어지지 않도록 최근 AI 발화 세 건만 표시한다.
	const previous = call.captionHistory.slice(0, -1);
	const current = call.captionHistory.at(-1) || "";
	ui.captionHistory.textContent = previous.join(" ") || "AI 실시간 자막";
	ui.captionCurrent.textContent = current;
}

async function endCall() {
	if (call.ending) {
		return;
	}
	call.ending = true;
	call.cancelRequested = true;
	setCallState("종료 중", "통화를 안전하게 종료하고 있습니다");
	ui.endCallButton.disabled = true;
	log("통화 종료 요청");

	try {
		// 세션 생성 중 종료했다면 생성 응답에서 ID를 받은 뒤 즉시 종료한다.
		if (!call.callSessionId && call.sessionCreationPromise) {
			const payload = await call.sessionCreationPromise;
			call.callSessionId = payload.call_session_id;
		}
		const reportExpected = call.startedAt !== null;
		await requestCallEnd("USER_REQUESTED");
		finishLocally("편안한 대화가 되었기를 바랍니다.", reportExpected);
		if (reportExpected) {
			void pollForCallReport(call.callSessionId);
		}
	} catch (error) {
		log(`종료 API 실패: ${safeErrorMessage(error)}`);
		finishLocally("브라우저 연결은 종료했지만 서버 상태 확인이 필요합니다.", false);
	}
}

function finishLocally(message, reportExpected = false) {
	call.ending = true;
	updateDuration();
	const duration = formatDuration(call.durationSeconds);
	cleanupMedia();
	ui.endedDuration.textContent = duration;
	ui.endedMessage.textContent = message;
	if (reportExpected) {
		renderReportPending();
	} else {
		renderReportUnavailable("이 통화는 요약 생성 대상이 아닙니다.", false);
	}
	showScreen("ended");
	log("브라우저 통화 자원 정리 완료");
}

async function pollForCallReport(callSessionId) {
	const runId = ++call.reportPollingRunId;
	renderReportPending();
	log(`통화 요약 생성 확인 시작 #${callSessionId}`);

	for (let attempt = 0; attempt < REPORT_POLL_MAX_ATTEMPTS; attempt += 1) {
		if (runId !== call.reportPollingRunId) {
			return;
		}

		try {
			const report = await fetchCallReport(callSessionId);
			if (runId !== call.reportPollingRunId) {
				return;
			}
			if (report.report_status === "READY") {
				renderReportReady(report);
				log(`통화 요약 생성 완료 #${callSessionId}`);
				return;
			}
			if (report.report_status === "NOT_APPLICABLE") {
				renderReportUnavailable("이 통화는 요약 생성 대상이 아닙니다.", false);
				log(`통화 요약 생성 대상 아님 #${callSessionId}`);
				return;
			}
		} catch (error) {
			log(`통화 요약 확인 실패: ${safeErrorMessage(error)}`);
		}

		await wait(REPORT_POLL_INTERVAL_MS);
	}

	if (runId === call.reportPollingRunId) {
		renderReportUnavailable("요약 생성이 지연되고 있습니다. 잠시 후 다시 확인해 주세요.", true);
		log(`통화 요약 생성 확인 시간 초과 #${callSessionId}`);
	}
}

async function fetchCallReport(callSessionId) {
	const response = await fetch(`/ai-call/dev/call-sessions/${callSessionId}/report`);
	return readApiResponse(response);
}

function renderReportPending() {
	ui.reportStatus.textContent = "생성 중";
	ui.reportStatus.className = "report-status is-pending";
	ui.reportSummary.textContent = "통화 내용을 정리하고 있습니다.";
	ui.reportDetails.classList.add("is-hidden");
	ui.reportCreatedAt.textContent = "";
	ui.reportRetryButton.classList.add("is-hidden");
}

function renderReportReady(report) {
	ui.reportStatus.textContent = "생성 완료";
	ui.reportStatus.className = "report-status is-ready";
	ui.reportSummary.textContent = report.summary;
	ui.reportEmotionCategory.textContent = report.emotion_category;
	ui.reportEmotionSubcategory.textContent = report.emotion_subcategory;
	ui.reportGuardianMessage.textContent = report.guardian_message || "전달할 별도 메시지가 없습니다.";
	ui.reportDetails.classList.remove("is-hidden");
	ui.reportCreatedAt.textContent = report.created_at
		? `${new Date(report.created_at).toLocaleString("ko-KR")} 생성`
		: "";
	ui.reportRetryButton.classList.add("is-hidden");
}

function renderReportUnavailable(message, retryable) {
	ui.reportStatus.textContent = retryable ? "확인 지연" : "생성 안 함";
	ui.reportStatus.className = "report-status is-unavailable";
	ui.reportSummary.textContent = message;
	ui.reportDetails.classList.add("is-hidden");
	ui.reportCreatedAt.textContent = "";
	ui.reportRetryButton.classList.toggle("is-hidden", !retryable);
}

function wait(milliseconds) {
	return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function toggleMicrophone() {
	call.microphoneOn = !call.microphoneOn;
	// 로컬 마이크 트랙만 비활성화하므로 원격 AI 음성은 계속 들을 수 있다.
	for (const track of call.localStream?.getAudioTracks() ?? []) {
		track.enabled = call.microphoneOn;
	}
	ui.microphoneButton.setAttribute("aria-pressed", String(call.microphoneOn));
	ui.microphoneButton.setAttribute("aria-label", call.microphoneOn ? "마이크 끄기" : "마이크 켜기");
	log(`마이크 ${call.microphoneOn ? "켜짐" : "꺼짐"}`);
}

function toggleSpeaker() {
	call.speakerOn = !call.speakerOn;
	// 원격 audio 요소만 음소거하며 WebRTC 연결과 마이크 송신은 유지한다.
	ui.remoteAudio.muted = !call.speakerOn;
	ui.speakerButton.setAttribute("aria-pressed", String(call.speakerOn));
	ui.speakerButton.setAttribute("aria-label", call.speakerOn ? "스피커 끄기" : "스피커 켜기");
	log(`스피커 ${call.speakerOn ? "켜짐" : "꺼짐"}`);
}

async function reportConnectionResult(result, errorCode) {
	// 동일 브라우저에서 연결 결과를 중복 보고하지 않는다.
	if (!call.callSessionId || call.connectionReported) {
		return;
	}
	try {
		const response = await fetch(`/call-sessions/${call.callSessionId}/connection-result`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				result,
				error_code: errorCode,
			}),
		});
		await readApiResponse(response);
		call.connectionReported = true;
		log(`연결 결과 전송: ${result}`);
	} catch (error) {
		log(`연결 결과 전송 실패: ${safeErrorMessage(error)}`);
		if (result === "CONNECTED") {
			throw error;
		}
	}
}

async function createCallSession(personaId, sdpOffer) {
	// 서버가 권한·페르소나를 검증하고 OpenAI와 SDP를 교환한다.
	const response = await fetch("/call-sessions", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			persona_id: personaId,
			sdp_offer: sdpOffer,
		}),
	});
	return readApiResponse(response);
}

async function requestCallEnd(terminationType = "USER_REQUESTED") {
	if (!call.callSessionId) {
		return;
	}
	const response = await fetch(`/call-sessions/${call.callSessionId}/end`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			termination_type: terminationType,
		}),
	});
	await readApiResponse(response);
}

function throwIfCallCancelled() {
	// 비동기 연결 단계 사이마다 호출해 늦게 도착한 응답이 취소된 통화를 다시 진행하지 못하게 한다.
	if (call.cancelRequested) {
		throw new CallCancelledError();
	}
}

function waitForConnected(peerConnection, timeoutMs) {
	if (peerConnection.connectionState === "connected") {
		return Promise.resolve();
	}
	return new Promise((resolve, reject) => {
		// 브라우저별 연결 지연이 무한 대기로 이어지지 않도록 제한 시간을 둔다.
		const timeoutId = window.setTimeout(() => {
			peerConnection.removeEventListener("connectionstatechange", handleState);
			reject(new Error("20초 안에 통화가 연결되지 않았습니다."));
		}, timeoutMs);

		function handleState() {
			if (peerConnection.connectionState === "connected") {
				window.clearTimeout(timeoutId);
				peerConnection.removeEventListener("connectionstatechange", handleState);
				resolve();
			} else if (peerConnection.connectionState === "failed") {
				window.clearTimeout(timeoutId);
				peerConnection.removeEventListener("connectionstatechange", handleState);
				reject(new Error("WebRTC 연결에 실패했습니다."));
			} else if (peerConnection.connectionState === "closed") {
				window.clearTimeout(timeoutId);
				peerConnection.removeEventListener("connectionstatechange", handleState);
				reject(new CallCancelledError());
			}
		}

		peerConnection.addEventListener("connectionstatechange", handleState);
	});
}

async function readApiResponse(response) {
	// 성공 응답과 공통 오류 응답을 한 곳에서 해석해 호출부의 처리를 단순화한다.
	const contentType = response.headers.get("content-type") || "";
	const payload = contentType.includes("application/json") ? await response.json() : null;
	if (!response.ok) {
		throw new Error(payload?.error?.message || `서버 요청이 실패했습니다. (${response.status})`);
	}
	return payload;
}

function beginTimer() {
	call.startedAt = Date.now();
	updateDuration();
	call.timerId = window.setInterval(updateDuration, 1000);
}

function updateDuration() {
	if (call.startedAt) {
		call.durationSeconds = Math.max(0, Math.floor((Date.now() - call.startedAt) / 1000));
	}
	ui.timer.textContent = formatDuration(call.durationSeconds);
}

function formatDuration(seconds) {
	const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
	const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
	return `${minutes} : ${remainingSeconds}`;
}

function cleanupMedia() {
	// 브라우저의 타이머·DataChannel·WebRTC·마이크를 모두 해제한다.
	if (call.timerId) {
		window.clearInterval(call.timerId);
		call.timerId = null;
	}
	call.dataChannel?.close();
	call.peerConnection?.close();
	for (const track of call.localStream?.getTracks() ?? []) {
		track.stop();
	}
	ui.remoteAudio.srcObject = null;
	call.dataChannel = null;
	call.peerConnection = null;
	call.localStream = null;
}

function resetCallRuntime() {
	// 새 통화가 이전 통화의 ID, 자막, 취소 상태를 이어받지 않도록 초기 상태로 되돌린다.
	cleanupMedia();
	call.callSessionId = null;
	call.startedAt = null;
	call.durationSeconds = 0;
	call.connectionReported = false;
	call.ending = false;
	call.cancelRequested = false;
	call.sessionCreationPromise = null;
	call.microphoneOn = true;
	call.speakerOn = true;
	call.captionDraft = "";
	call.captionHistory = [];
	call.reportPollingRunId += 1;
	ui.timer.textContent = "00 : 00";
	ui.captionHistory.textContent = "연결되면 AI의 말이 이곳에 표시됩니다.";
	ui.captionCurrent.textContent = "";
	ui.remoteAudio.muted = false;
	ui.microphoneButton.setAttribute("aria-pressed", "true");
	ui.speakerButton.setAttribute("aria-pressed", "true");
	ui.endCallButton.disabled = false;
	renderReportPending();
}

class CallCancelledError extends Error {
	constructor() {
		super("통화 연결이 취소되었습니다.");
		this.name = "CallCancelledError";
	}
}

function showScreen(screenName) {
	ui.selectionScreen.classList.toggle("is-hidden", screenName !== "selection");
	ui.callScreen.classList.toggle("is-hidden", screenName !== "call");
	ui.endedScreen.classList.toggle("is-hidden", screenName !== "ended");
}

function setCallState(status, detail) {
	ui.callStatus.textContent = status;
	ui.turnLabel.textContent = detail;
	ui.logState.textContent = status;
}

function showError(message) {
	ui.toast.textContent = message;
	ui.toast.classList.remove("is-hidden");
	// 연속 오류가 발생하면 이전 숨김 타이머를 취소해 마지막 메시지를 5초간 보장한다.
	window.clearTimeout(showError.timeoutId);
	showError.timeoutId = window.setTimeout(() => ui.toast.classList.add("is-hidden"), 5000);
}

function safeErrorMessage(error) {
	return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
}

function log(message) {
	const entry = document.createElement("li");
	entry.textContent = `${new Date().toLocaleTimeString("ko-KR", { hour12: false })} ${message}`;
	ui.logEntries.append(entry);
	while (ui.logEntries.children.length > 40) {
		ui.logEntries.firstElementChild.remove();
	}
	ui.logEntries.scrollTop = ui.logEntries.scrollHeight;
}

function returnToSelection() {
	resetCallRuntime();
	showScreen("selection");
	ui.logState.textContent = "대기 중";
}

ui.startCallButton.addEventListener("click", startCall);
ui.endCallButton.addEventListener("click", endCall);
ui.microphoneButton.addEventListener("click", toggleMicrophone);
ui.speakerButton.addEventListener("click", toggleSpeaker);
ui.reportRetryButton.addEventListener("click", () => {
	if (call.callSessionId) {
		void pollForCallReport(call.callSessionId);
	}
});
ui.backButton.addEventListener("click", returnToSelection);

window.addEventListener("beforeunload", () => {
	if (call.callSessionId && !call.ending) {
		// 페이지 종료 중에도 서버에 종료 요청이 전송되도록 keepalive를 사용한다.
		fetch(`/call-sessions/${call.callSessionId}/end`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				termination_type: "USER_REQUESTED",
			}),
			keepalive: true,
		}).catch(() => {});
	}
	cleanupMedia();
});

renderPersonas();
log("AI 전화 개발 UI 준비 완료");
