# OpenAI Realtime 음성 대화 PoC

Android Studio에서 `android/`를 열고, FastAPI 백엔드를 별도 터미널에서 실행해 WebRTC 기반 Realtime 음성 대화를 시험하는 독립 PoC입니다. API Key는 `backend/.env`에만 두며 Android APK에는 포함하지 않습니다.

재현 가능한 Windows 테스트 절차는 [테스트 재현 가이드](docs/test-reproduction.md)를 참고합니다.

## 1. Windows PowerShell 실행

### 백엔드

```powershell
cd C:\S15P11B104\realtime-voice-poc\backend
Copy-Item .env.example .env
# .env의 OPENAI_API_KEY 입력
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

PowerShell 실행 정책 때문에 `Activate.ps1`를 사용할 수 있어도 가상환경의 Python을 직접 호출하면 됩니다. 준비가 끝난 뒤에는 `.\run.ps1`로 실행할 수 있습니다.

다른 터미널에서 백엔드 상태를 확인합니다.

```powershell
Invoke-RestMethod http://localhost:8000/health
# status
# ------
# ok
```

### Android Studio

1. Android Studio에서 `C:\S15P11B104\realtime-voice-poc\android`를 엽니다.
2. Gradle Sync가 끝나면 `app` Run Configuration으로 Emulator 또는 실제 기기에 실행합니다.
3. 프로젝트 루트가 아닌 `android`에서 다음을 실행할 수 있습니다.

```powershell
cd C:\S15P11B104\realtime-voice-poc\android
.\gradlew.bat testDebugUnitTest
.\gradlew.bat assembleDebug
```

기본 Emulator 백엔드 주소는 `http://10.0.2.2:8000`입니다. 다른 주소가 필요하면 `android/local.properties`에 다음을 추가합니다. 이 파일은 기기별 설정이므로 커밋하지 않습니다.

```properties
backend.baseUrl=http://10.0.2.2:8000
```

USB 연결 기기는 먼저 다음을 실행합니다.

```powershell
adb reverse tcp:8000 tcp:8000
```

동일 Wi-Fi의 실제 기기는 `backend.baseUrl`에 개발 PC의 LAN IP를 입력합니다. 로컬 HTTP cleartext 허용은 Debug Manifest에만 있습니다.

## 2. 구현 범위

- RECORD_AUDIO 권한 요청 및 거부 오류 표시
- WebRTC 네트워크 상태 감시에 필요한 `ACCESS_NETWORK_STATE` 선언
- WebRTC 통화 오디오 라우팅에 필요한 `MODIFY_AUDIO_SETTINGS` 선언
- Android WebRTC PeerConnection, 마이크 AudioTrack, 원격 AudioTrack 재생
- `oai-events` DataChannel 생성과 Realtime 서버 이벤트 로그
- `session.updated` 확인 후 연결 완료 상태 전환
- SDP Offer를 FastAPI로 보내고 OpenAI Realtime SDP Answer를 적용
- `server_vad` 기반 발화 시작·종료, 수동 `response.create` 요청 및 응답 큐잉
- 통화 시작·종료 및 오류 시 PeerConnection, DataChannel, AudioTrack, AudioSource, AudioSink, 통계 코루틴 해제
- 연결 시간, 발화 종료부터 첫 원격 PCM 프레임까지의 시간, 응답 완료 시간 표시
- 1초 주기 WebRTC 통계: RTT, jitter, packets received/lost, packet loss, jitter buffer delay, inbound audio bitrate
- FastAPI `/health`, `/realtime/session` 및 OpenAI 오류의 안전한 변환

`speech_to_first_audio_ms`는 원격 AudioTrack의 PCM 프레임을 우선 사용합니다. 단말 WebRTC 구현에서 프레임 콜백이 오지 않는 경우 `response.audio.delta` 등 서버 이벤트를 근사 기준으로 사용합니다.

## 3. 백엔드 계약

`POST /realtime/session`은 `Content-Type: application/sdp`의 raw SDP Offer를 받습니다. 서버가 다음 multipart 필드로 OpenAI에 전달합니다.

- `sdp`: `application/sdp`
- `session`: `application/json`

OpenAI의 SDP Answer만 `application/sdp`로 반환하며, API Key·SDP·음성 데이터를 로그에 기록하지 않습니다. API Key가 없으면 503, 잘못된 입력은 4xx, OpenAI 오류는 비밀정보를 제거한 502로 반환합니다.

## 4. Documentation verification

구현 전 Context7 library resolution과 문서 조회를 수행했습니다.

| 대상 | Context7 library ID | 확인한 API 결정 |
| --- | --- | --- |
| OpenAI Realtime API | `/websites/developers_openai_api` | WebRTC SDP Offer, `oai-events`, `/v1/realtime/calls`, `session.update`, `server_vad`, 음성 이벤트 |
| Android WebRTC | `/webrtc-sdk/android` | `PeerConnectionFactory`, AudioSource/AudioTrack, DataChannel, ICE gathering, `getStats()` |
| Jetpack Compose | `/websites/developer_android_develop_ui_compose` | Material 3, Compose BOM, `collectAsStateWithLifecycle` |
| FastAPI | `/fastapi/fastapi` | `await request.body()`, `Response(media_type=...)`, `HTTPException` |
| HTTPX | `/encode/httpx` | `AsyncClient`, async POST, multipart `files` 필드 |
| Kotlin Coroutines | `/kotlin/kotlinx.coroutines` | 구조화된 취소, CoroutineScope, Flow 수명 관리 |

주요 확인 문서:

- OpenAI Realtime WebRTC: <https://developers.openai.com/api/docs/guides/realtime-webrtc>
- OpenAI Realtime VAD: <https://developers.openai.com/api/docs/guides/realtime-vad>
- OpenAI Realtime API reference: <https://developers.openai.com/api/docs/api-reference/realtime>
- WebRTC SDK Android README: <https://github.com/webrtc-sdk/android>

Context7에서 OpenAI의 Android Kotlin 전체 샘플은 제공되지 않아, Android WebRTC 호출부는 Context7의 `org.webrtc` API와 Android SDK 런타임 계약을 조합했습니다. 현재 Realtime 오디오 서버 이벤트의 기기별 전달 여부는 실제 API Key와 단말에서 확인해야 합니다.

## 5. 선택한 의존성 버전

- Gradle 8.11.1, Android Gradle Plugin 8.10.1, Kotlin 2.1.20, Java target 17
- Compose BOM 2025.05.00, Activity Compose 1.10.1, Lifecycle 2.9.0
- Kotlin Coroutines 1.10.1
- `io.github.webrtc-sdk:android:144.7559.01`
- FastAPI 0.115.13, HTTPX 0.28.1, Uvicorn 0.34.3

Android Studio bundled JDK 21에서 실행할 수 있고, Android SDK 36을 사용합니다. Compose compiler는 Kotlin 2.1.20과 함께 제공되는 Gradle plugin을 사용해 별도 compiler extension 버전을 고정하지 않았습니다. WebRTC 좌표와 버전은 Context7의 공식 `webrtc-sdk/android` README 결과를 사용했습니다.

## 6. 수동 음성 품질 체크리스트

실제 API Key를 입력한 뒤 다음을 확인합니다.

- 조용한 환경에서 짧은 질문 5회
- 긴 문장 질문 3회
- 발화 중 잠시 멈췄다가 계속 말하기
- AI 응답 중 끼어들기
- 주변 소음 환경
- Wi-Fi 및 모바일 네트워크
- 연속 통화 시작·종료
- 마이크 권한 거부
- 백엔드 중단
- 잘못된 API Key

평가 항목은 음성 선명도, 끊김, 왜곡, 발화 인식, 응답 시작 지연, 끼어들기 반응, RTT, jitter, packet loss입니다.

## 7. 검증 상태

최종 검증 결과: FastAPI 테스트 6건, `pip check`, Android `testDebugUnitTest`, `assembleDebug`, live `/health`(HTTP 200)를 통과했습니다. `emulator-5554`에서 실제 SDP 협상과 WebRTC 연결, 48 kHz 원격 출력, `underrun count: 0`, `active response in progress` 오류 미재현을 확인했습니다. 실제 음성·주변소음 조건에서의 VAD 전환 품질은 [테스트 재현 가이드](docs/test-reproduction.md)의 수동 체크리스트로 확인합니다.
