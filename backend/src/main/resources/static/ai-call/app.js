const personas = [
	{ id: 1, name: "든든한 아들", voice: "cedar", initial: "아", description: "침착하고 믿음직하게 안부와 건강을 살펴요." },
	{ id: 2, name: "살가운 딸", voice: "coral", initial: "딸", description: "일상과 감정을 세심하게 묻고 공감해요." },
	{ id: 3, name: "활기찬 손자", voice: "ash", initial: "손", description: "밝은 분위기로 취미와 가족 이야기를 나눠요." },
	{ id: 4, name: "다정한 손녀", voice: "shimmer", initial: "녀", description: "작은 이야기에도 따뜻하게 귀 기울여요." },
	{ id: 5, name: "편안한 오랜 친구", voice: "marin", initial: "친", description: "부담 없이 동등한 친구처럼 대화해요." },
	{ id: 6, name: "차분한 생활 도우미", voice: "sage", initial: "도", description: "일정과 생활 정보를 정확하고 간결하게 안내해요." },
];

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
	backButton: document.querySelector("#backButton"),
	remoteAudio: document.querySelector("#remoteAudio"),
	logEntries: document.querySelector("#logEntries"),
	logState: document.querySelector("#logState"),
	toast: document.querySelector("#toast"),
};

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
};

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
		call.localStream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
			},
		});
		throwIfCallCancelled();
		log("마이크 스트림 준비 완료");

		call.peerConnection = new RTCPeerConnection();
		call.peerConnection.addEventListener("track", handleRemoteTrack);
		call.peerConnection.addEventListener("connectionstatechange", handleConnectionStateChange);
		for (const track of call.localStream.getTracks()) {
			call.peerConnection.addTrack(track, call.localStream);
		}

		call.dataChannel = call.peerConnection.createDataChannel("oai-events");
		call.dataChannel.addEventListener("open", () => log("Realtime 이벤트 채널 연결"));
		call.dataChannel.addEventListener("message", handleRealtimeEvent);
		call.dataChannel.addEventListener("close", () => log("Realtime 이벤트 채널 종료"));

		setCallState("연결 중", "WebRTC SDP를 교환하고 있습니다");
		const offer = await call.peerConnection.createOffer();
		await call.peerConnection.setLocalDescription(offer);
		throwIfCallCancelled();
		log("SDP offer 생성");

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

		await waitForConnected(call.peerConnection, 20_000);
		throwIfCallCancelled();
		await reportConnectionResult("CONNECTED");
		throwIfCallCancelled();
		beginTimer();
		setCallState("통화 중", "말씀하시면 AI가 답합니다");
		log("WebRTC 통화 연결 완료");
	} catch (error) {
		call.sessionCreationPromise = null;
		if (error instanceof CallCancelledError || call.cancelRequested) {
			cleanupMedia();
			return;
		}
		log(`연결 실패: ${safeErrorMessage(error)}`);
		await reportConnectionResult("FAILED", "WEBRTC_CONNECTION_FAILED");
		if (call.callSessionId && !call.connectionReported) {
			try {
				await requestCallEnd();
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
	if ((state === "failed" || state === "disconnected") && call.startedAt && !call.ending) {
		void endAfterConnectionLoss();
	}
}

async function endAfterConnectionLoss() {
	call.ending = true;
	call.cancelRequested = true;
	log("WebRTC 연결 단절 감지");
	try {
		await requestCallEnd();
		finishLocally("연결이 종료되었습니다.");
	} catch (error) {
		log(`연결 단절 정리 실패: ${safeErrorMessage(error)}`);
		finishLocally("브라우저 연결은 종료했지만 서버 상태 확인이 필요합니다.");
	}
}

function handleRealtimeEvent(message) {
	let event;
	try {
		event = JSON.parse(message.data);
	} catch {
		log("해석할 수 없는 Realtime 이벤트");
		return;
	}

	if (event.type !== "response.output_audio.delta") {
		log(`Realtime: ${event.type}`);
	}

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
		if (!call.callSessionId && call.sessionCreationPromise) {
			const payload = await call.sessionCreationPromise;
			call.callSessionId = payload.call_session_id;
		}
		await requestCallEnd();
		finishLocally("편안한 대화가 되었기를 바랍니다.");
	} catch (error) {
		log(`종료 API 실패: ${safeErrorMessage(error)}`);
		finishLocally("브라우저 연결은 종료했지만 서버 상태 확인이 필요합니다.");
	}
}

function finishLocally(message) {
	call.ending = true;
	updateDuration();
	const duration = formatDuration(call.durationSeconds);
	cleanupMedia();
	ui.endedDuration.textContent = duration;
	ui.endedMessage.textContent = message;
	showScreen("ended");
	log("브라우저 통화 자원 정리 완료");
}

function toggleMicrophone() {
	call.microphoneOn = !call.microphoneOn;
	for (const track of call.localStream?.getAudioTracks() ?? []) {
		track.enabled = call.microphoneOn;
	}
	ui.microphoneButton.setAttribute("aria-pressed", String(call.microphoneOn));
	ui.microphoneButton.setAttribute("aria-label", call.microphoneOn ? "마이크 끄기" : "마이크 켜기");
	log(`마이크 ${call.microphoneOn ? "켜짐" : "꺼짐"}`);
}

function toggleSpeaker() {
	call.speakerOn = !call.speakerOn;
	ui.remoteAudio.muted = !call.speakerOn;
	ui.speakerButton.setAttribute("aria-pressed", String(call.speakerOn));
	ui.speakerButton.setAttribute("aria-label", call.speakerOn ? "스피커 끄기" : "스피커 켜기");
	log(`스피커 ${call.speakerOn ? "켜짐" : "꺼짐"}`);
}

async function reportConnectionResult(result, errorCode) {
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

async function requestCallEnd() {
	if (!call.callSessionId) {
		return;
	}
	const response = await fetch(`/call-sessions/${call.callSessionId}/end`, {
		method: "POST",
	});
	await readApiResponse(response);
}

function throwIfCallCancelled() {
	if (call.cancelRequested) {
		throw new CallCancelledError();
	}
}

function waitForConnected(peerConnection, timeoutMs) {
	if (peerConnection.connectionState === "connected") {
		return Promise.resolve();
	}
	return new Promise((resolve, reject) => {
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
	ui.timer.textContent = "00 : 00";
	ui.captionHistory.textContent = "연결되면 AI의 말이 이곳에 표시됩니다.";
	ui.captionCurrent.textContent = "";
	ui.remoteAudio.muted = false;
	ui.microphoneButton.setAttribute("aria-pressed", "true");
	ui.speakerButton.setAttribute("aria-pressed", "true");
	ui.endCallButton.disabled = false;
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
ui.backButton.addEventListener("click", returnToSelection);

window.addEventListener("beforeunload", () => {
	if (call.callSessionId && !call.ending) {
		fetch(`/call-sessions/${call.callSessionId}/end`, {
			method: "POST",
			keepalive: true,
		}).catch(() => {});
	}
	cleanupMedia();
});

renderPersonas();
log("AI 전화 개발 UI 준비 완료");
