# Realtime Voice PoC 테스트 재현 가이드

최종 확인 기준일: 2026-07-20  
검증 OS: Windows 11  
프로젝트 예시 경로: C:\S15P11B104\realtime-voice-poc

이 문서는 API Key를 Android APK에 넣지 않고, FastAPI 백엔드와 Android Emulator를 연결해 현재 PoC 테스트를 재현하는 절차입니다.

## 1. 테스트 구성

    Android Emulator
      └─ http://10.0.2.2:8000/realtime/session
           ↓
    FastAPI backend :8000
           ↓
    OpenAI Realtime Calls API

| 항목 | 현재 기준 |
| --- | --- |
| AVD | AI_Call_Test |
| Emulator serial | emulator-5554 |
| Android SDK | 36 |
| Android Studio JDK | 21.0.10 |
| Gradle | 8.11.1 |
| Android Gradle Plugin | 8.10.1 |
| Kotlin Gradle Plugin | 2.1.20 |
| Python | 3.14.6 |
| WebRTC SDK | io.github.webrtc-sdk:android:144.7559.01 |
| Backend port | 8000 |

## 2. 사전 준비

- Android Studio와 Android SDK 36 설치
- Android Studio의 bundled JDK 설치
- Python Launcher(py) 설치
- 유효한 OpenAI API Key와 인터넷 연결
- Android Studio SDK Manager에서 Emulator와 platform-tools 설치

프로젝트 폴더로 이동합니다.

    $POC_ROOT = 'C:\S15P11B104\realtime-voice-poc'
    Set-Location $POC_ROOT

## 3. 백엔드 준비 및 실행

최초 1회만 환경 파일을 만들고 API Key를 입력합니다. API Key는 파일 외부나 Android 소스에 기록하지 않습니다.

    Set-Location "$POC_ROOT\backend"
    Copy-Item .env.example .env
    notepad .env

.env에는 다음 값을 사용합니다.

    OPENAI_API_KEY=실제_API_KEY
    OPENAI_REALTIME_MODEL=gpt-realtime-2.1
    OPENAI_REALTIME_VOICE=marin

가상환경과 의존성을 준비합니다.

    if (-not (Test-Path .venv)) {
        py -3 -m venv .venv
    }
    .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    .\.venv\Scripts\python.exe -m pip check

백엔드를 별도 PowerShell 창에서 실행합니다.

    Set-Location "$POC_ROOT\backend"
    .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000

다른 창에서 상태를 확인합니다.

    Invoke-RestMethod http://127.0.0.1:8000/health
    # status
    # ------
    # ok

## 4. Emulator 준비

Android SDK 경로를 확인하고 Emulator를 실행합니다.

    $sdkDir = 'C:\Users\SSAFY\AppData\Local\Android\Sdk'
    & "$sdkDir\emulator\emulator.exe" -list-avds
    & "$sdkDir\emulator\emulator.exe" -avd AI_Call_Test

Emulator가 부팅된 뒤 별도 창에서 연결을 확인합니다.

    $adb = "$sdkDir\platform-tools\adb.exe"
    & $adb wait-for-device
    & $adb devices
    # emulator-5554    device

## 5. Android 백엔드 주소 설정

android/local.properties는 장치별 로컬 설정이므로 커밋하지 않습니다. Android Emulator에서는 다음 주소를 사용합니다.

    backend.baseUrl=http://10.0.2.2:8000

10.0.2.2는 Emulator에서 개발 PC의 localhost를 가리킵니다. Android 앱에서 localhost:8000을 사용하면 Emulator 자기 자신을 가리키므로 백엔드에 연결되지 않습니다.

실제 기기를 USB로 테스트할 때는 백엔드 실행 중인 PC에서 다음을 실행하고 주소를 바꿉니다.

    & $adb reverse tcp:8000 tcp:8000

    backend.baseUrl=http://127.0.0.1:8000

## 6. 빌드, 설치, 실행

Android Studio에서 android/ 폴더를 열어도 되고, 다음 명령으로 재현할 수도 있습니다.

    Set-Location "$POC_ROOT\android"
    $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
    .\gradlew.bat testDebugUnitTest assembleDebug --no-daemon

APK를 Emulator에 설치하고 실행합니다.

    & $adb -s emulator-5554 install -r "$POC_ROOT\android\app\build\outputs\apk\debug\app-debug.apk"
    & $adb -s emulator-5554 shell am force-stop com.example.realtimevoicepoc
    & $adb -s emulator-5554 shell monkey -p com.example.realtimevoicepoc 1

앱에서 다음 순서로 진행합니다.

1. 마이크 권한을 허용합니다.
2. 통화 시작을 누릅니다.
3. 상태가 연결됨이 될 때까지 기다립니다.
4. 짧은 한국어 문장을 말합니다.
5. AI 응답 중 다시 말해 응답이 중복 생성되지 않는지 확인합니다.
6. 통화 종료를 눌러 오디오 라우팅과 Emulator 볼륨이 복원되는지 확인합니다.

## 7. 오디오 및 VAD 검증

실행 중 다음 로그를 확인합니다.

    & $adb -s emulator-5554 logcat -d -t 2500 |
        Select-String -Pattern 'initPlayout|AudioTrack:.*sample rate|VOICE_CALL|underrun|active response|FATAL'

정상적인 Emulator 출력 기준은 다음과 같습니다.

    initPlayout(sampleRate=48000, channels=1
    AudioTrack: ... sample rate: 48000
    VOICE_CALL stream volume: 15 (max=15)
    underrun count: 0

Emulator의 입력 녹음은 장치 특성상 8 kHz로 표시될 수 있습니다. 확인할 값은 initPlayout과 AudioTrack의 출력 샘플레이트가 48 kHz인지입니다.

현재 VAD 설정은 백엔드와 Android 양쪽에 동일하게 적용되어야 합니다.

    type: server_vad
    threshold: 0.7
    prefix_padding_ms: 300
    silence_duration_ms: 900
    create_response: false
    interrupt_response: false

create_response=false이므로 Android가 input_audio_buffer.speech_stopped를 받은 뒤 response.create를 한 번만 전송합니다. 응답 중 새 발화가 들어오면 현재 응답이 끝난 뒤 하나의 응답만 예약합니다.

다음 오류가 나타나면 새 APK가 설치되지 않았거나 백엔드가 이전 프로세스로 실행 중인 상태입니다.

    Conversation already has an active response in progress

이 경우 백엔드와 앱을 모두 재시작하고, create_response=false가 양쪽 소스에 반영됐는지 확인합니다.

## 8. 자동 검증 명령

백엔드 테스트:

    Set-Location "$POC_ROOT\backend"
    .\.venv\Scripts\python.exe -m pytest -q

기대 결과: 6 passed

Android 테스트와 APK 빌드:

    Set-Location "$POC_ROOT\android"
    $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
    .\gradlew.bat testDebugUnitTest assembleDebug --no-daemon

기대 결과: BUILD SUCCESSFUL

## 9. 재현 기록 양식

테스트 결과를 남길 때 다음 항목을 함께 기록합니다.

    일시:
    프로젝트 커밋 또는 변경 상태:
    Windows:
    Android Studio / JDK:
    AVD:
    Emulator serial:
    Backend model / voice:
    연결 결과:
    AudioTrack 출력 샘플레이트:
    VOICE_CALL 볼륨:
    underrun:
    speech_started / speech_stopped 횟수:
    response.created / response.done 횟수:
    active response 오류 여부:
    음성 품질 및 끊김:

API Key, SDP, Authorization 헤더, 음성 원문은 기록하지 않습니다.

## 10. 주요 문제 해결

| 증상 | 확인할 항목 |
| --- | --- |
| Backend returned HTTP 502 | 백엔드 실행 여부, .env의 API Key, 포트 8000, sdp multipart 필드 |
| OpenAI API key is not configured | backend/.env에 키가 있고 백엔드를 재시작했는지 |
| active response in progress | 앱 재설치 여부, create_response=false, Android의 수동 response.create 큐잉 |
| Emulator에서 백엔드 연결 실패 | backend.baseUrl이 http://10.0.2.2:8000인지 |
| 실제 기기에서 연결 실패 | adb reverse 또는 PC LAN IP 사용 여부 |
| 소리가 작거나 지직거림 | AudioTrack 48 kHz, VOICE_CALL 볼륨, underrun count, 실제 기기 비교 |
| 주변소음에 자주 반응 | 조용한 환경 재시험, threshold=0.7, silence_duration_ms=900, 실제 기기 또는 헤드셋 비교 |
