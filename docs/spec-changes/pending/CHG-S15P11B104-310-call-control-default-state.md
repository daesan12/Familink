# AI 전화 통화 제어의 기본 상태와 조작 가능 단계 규정

- 상태: 제안
- 제안자: 손수호
- 작성일: 2026-08-05
- 차단 변경: 아니오
- 영향 스펙·계약: `docs/specs/domains/AI_CALL.md`
- 관련 작업: S15P11B104-310

## 기존 내용

- `docs/specs/domains/AI_CALL.md`의 "확정된 동작" 6번은 "통화 화면에는 통화 시간,
  음소거, 통화 종료, 스피커 제어와 AI 발화 실시간 자막을 제공한다"로, 제어의
  **존재**만 규정하고 각 제어의 기본 상태를 규정하지 않는다.
- 같은 문서의 인수 조건 `AC-002`는 `Given: 통화가 IN_PROGRESS다` / `When: AI가
  발화하고 사용자가 음소거·스피커·종료 제어를 사용한다`로 시작하지만, `Then`은
  자막과 transcript 처리 결과만 규정한다. 제어 사용의 결과나 `IN_PROGRESS` 이외
  단계에서의 조작 가능 여부는 규정하지 않는다.
- 같은 문서 "화면" 절은 "사용자에게 표시할 결과"로 `통화 제어`를 열거할 뿐
  상태별 표현을 규정하지 않는다.
- 오디오 출력 경로(스피커폰 대 수화기)에 대한 규정이 `docs/specs/` 전체에 없다.
  `contracts/DATA_MODEL.md`의 `speaker`는 전사 화자 구분(`USER`, `ASSISTANT`)이며
  오디오 출력과 무관하다.
- 같은 문서 "미결정 사항"에도 통화 제어 기본 상태와 오디오 출력 경로가 없어,
  미결정으로 추적되는 것조차 아닌 스펙 공백이다.
- 같은 저장소의 `docs/specs/domains/CALENDAR.md`는 "토글의 최초 기본 상태는
  꺼짐이며"처럼 기본 상태를 스펙에 적는 선례가 있다. AI 전화 제어에만 빠져 있다.

## 제안 내용

`docs/specs/domains/AI_CALL.md`의 "확정된 동작" 6번을 다음 두 항으로 구체화한다.

1. 통화가 연결되면 마이크는 켜진 상태, 오디오 출력은 일반 전화와 같은
   수화기(스피커폰 꺼짐) 상태로 시작한다. 스피커 제어를 사용하면 스피커폰으로
   전환하고, 다시 사용하면 수화기로 돌아온다.
2. 음소거와 스피커 제어는 통화가 `IN_PROGRESS`인 동안에만 조작할 수 있다. 통화
   연결 중과 종료 중에는 두 제어를 조작할 수 없다.
3. 통화 종료 제어는 연결 중과 통화 중에 사용할 수 있고, 이미 종료가 진행 중인
   동안에는 조작할 수 없다. 조작할 수 없는 제어는 조작할 수 있는 제어와 시각적으로
   구분한다.
4. 통화를 종료하고 다시 시작하면 마이크와 스피커 제어는 1번의 기본 상태로 돌아온다.

`AC-002`의 `Then`에 다음을 추가한다.

- 음소거와 스피커 제어의 조작 결과는 실제 마이크 전송과 오디오 출력 경로에
  즉시 반영된다.

아이콘 모양과 색상 규칙은 제안하지 않는다.
`docs/specs/UI_AND_NAVIGATION.md`가 "구현에 필수적이지 않은 색상·간격·픽셀 단위
디자인"을 제외 범위로 선언하고 있으므로, 사선 아이콘 사용 여부와 강조색은 스펙
대상이 아니다.

## 변경 근거

- 스피커 기본 상태를 수화기로 바꾸는 결정은 사용자가 이번 작업에서 직접 내렸다.
  기존 구현은 스피커폰으로 시작해 일반 전화 관례와 달랐다.
- 기존 구현의 두 지점이 스피커폰 시작을 강제하고 있었다.
  `frontend/android/app/src/main/java/com/s15p11b104app/aicall/AiCallContent.kt`의
  `isSpeakerOn` 초기값이 `true`였고,
  `frontend/android/app/src/main/java/com/s15p11b104app/aicall/AiCallWebRtc.kt`의
  `configureAudioRoute()`가 세션 생성 시 `isSpeakerphoneOn = true`를 넣었다. 화면
  상태만 바꾸면 실제 출력이 따라오지 않으므로 두 지점을 함께 규정할 근거가 있다.
- 2번의 근거는 확인된 구현 결함이다. 변경 전에는 연결 중·종료 중에도 마이크·스피커
  버튼이 눌렸고, 이때 `AiCallRuntime.setMicrophoneEnabled`와 `setSpeakerEnabled`는
  `webRtcSession`이 아직 `null`이라 조용히 no-op 했다. 결과적으로 화면은 음소거를
  표시하지만 실제 트랙은 켜져 있었다. `AiCallRuntimeTest.kt`가 이 no-op 동작을
  의도된 것으로 고정하고 있었다.
- 3번에서 종료 중 통화 종료 제어를 함께 막는 근거는 `AiCallContent.kt`의
  `finishCall`이 `phase`가 `Connecting` 또는 `InProgress`일 때만 동작하기 때문이다.
  종료 중에는 이미 no-op이므로, 2번으로 마이크·스피커만 흐리게 하면 "흐린 것은
  안 되고 밝은 것은 된다"는 규칙이 깨져 반응하지 않는 종료 버튼이 고장으로 읽힌다.
  같은 단계에서 시스템 뒤로 가기도 `AiCallPhase.Ending -> Unit`으로 소비된다.
- 1번의 실제 오디오 반영은 `android.permission.MODIFY_AUDIO_SETTINGS` 선언에
  의존한다. 이 권한이 없으면 `AudioService`가 `setMode`와 `setSpeakerphoneOn`을
  예외 없이 무시한다. 권한은 선행 티켓 S15P11B104-299의 커밋 `8ecc158`에서
  이미 선언되어 있다.
- 조작을 `IN_PROGRESS`로 한정하면 한 통화의 정상 생애주기 안에서는 화면 상태와 실제
  오디오가 어긋날 수 없다. `AiCallContent.kt`는 `runtime.start()`가 성공한 뒤에만
  `phase`를 `InProgress`로 바꾸고, `AiCallRuntime.kt`는 그보다 앞서 `webRtcSession`을
  대입한다. 즉 버튼을 누를 수 있는 시점에는 세션이 존재하므로 별도 재적용 로직이
  필요 없다.
- 다만 이 불변조건은 무조건적이지 않다. `phase`가 `rememberSaveable`이라 프로세스가
  죽은 뒤 복원되면 `phase`는 `InProgress`로 되살아나지만 `callRuntime`은 새로
  만들어져 `webRtcSession`이 없다. 이 상태에서는 제어가 활성인데 토글이 no-op 하므로
  같은 불일치가 남는다. 이 복원 구멍은 이번 변경 이전부터 있던 것이며 별도 처리가
  필요하다. 아래 `확인이 필요한 질문`에 남긴다.
- 4번의 근거는 재시도 경로다. 통화 실패 후 재시도는 `returnToSelection`을 거치지
  않아 이전 통화의 토글 상태가 남은 채 새 세션이 기본값으로 생성되었다.
- 구현과 회귀 테스트는 브랜치 `feature/S15P11B104-310-call-control-states`에 있다.
  검증은
  `frontend/android/app/src/androidTest/java/com/s15p11b104app/aicall/AiCallContentTest.kt`의
  기본 상태·상태 반영·토글 호출·연결 중 차단·종료 중 차단 5개 테스트다. 4번(재시도
  시 초기화)은 자동 테스트가 없다. 상태가 `AiCallRoute`에 있고 실패 후 재시도 경로를
  통과시키려면 실제 세션 생성이 필요해 Compose 테스트로 구동할 수 없다.
- QA 문서 `docs/qa/two-user-emulator-qa.md`의 `P5-03 음소거 토글`이 미실행
  상태였고, 이번 작업의 수동 확인 항목이 이를 덮는다.

## 확인된 영향

- 영향 도메인: `AI_CALL`. 다른 도메인 규칙은 바뀌지 않는다.
- 영향 계약: 없다. `contracts/API.md`의 `API-CALLS-001`~`API-CALLS-003`과
  `contracts/DATA_MODEL.md`는 변경되지 않는다. 오디오 출력 경로는 단말 로컬
  설정이며 서버로 전달되지 않는다.
- 영향 화면: IA `F-2` 통화 중 화면의 통화 제어 영역만 해당한다. `F-1` 페르소나
  선택과 `F-3` 종료 결과 화면은 변경되지 않는다.
- 검증 범위: `:app:compileDebugKotlin`, `:app:compileDebugAndroidTestKotlin`,
  `:app:testDebugUnitTest`, `:app:connectedDebugAndroidTest`, 그리고 에뮬레이터
  또는 실기기에서 실제 출력 경로 수동 확인. 출력 경로는 계기 테스트로 검증할 수
  없어 수동 확인이 필요하다.
- 커버리지 갱신 후보: `docs/specs/COVERAGE.md`의 `REQ-011 AI 통화 제어` 행. 현재
  비고 칸이 비어 있다. 확인 필요.

## 확인이 필요한 질문

- 프로세스가 죽은 뒤 복원될 때 통화 화면을 어떤 단계로 되살릴지 확인 필요. 현재는
  `phase`만 `rememberSaveable`로 복원되어 실제 세션 없이 통화 중 화면이 나타난다.
  이 경우 `Selecting`으로 되돌리는 것이 자연스러워 보이지만, 통화 단계 전체의 복원
  규칙이므로 이번 티켓 범위를 넘는다. 2번 규정의 전제가 되므로 별도 결정이 필요하다.
- 블루투스 헤드셋이나 유선 이어폰이 연결된 상태의 기본 출력 경로를 어떻게 볼지
  확인 필요. 이번 작업은 스피커폰 대 수화기 두 가지만 다루고, 현재 구현은
  deprecated된 `AudioManager.isSpeakerphoneOn`을 쓰므로 외부 오디오 장치를 우선
  선택하지 않는다. 외부 장치 우선 규칙이 필요하면 `setCommunicationDevice`(API
  31+)로 옮기는 별도 결정이 필요하다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
