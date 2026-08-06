# AI 통화 화면의 시스템 뒤로 가기 소비 규정

- 상태: 제안
- 제안자: 손수호
- 작성일: 2026-08-07
- 차단 변경: 아니오
- 영향 스펙·계약: `docs/specs/domains/AI_CALL.md`, `docs/specs/UI_AND_NAVIGATION.md`
- 관련 작업: S15P11B104-364
- 관련 제안: `CHG-S15P11B104-270-system-back-navigation.md`,
  `CHG-S15P11B104-310-call-control-default-state.md`

## 기존 내용

- `docs/specs/domains/AI_CALL.md`에는 "뒤로"라는 단어가 없다. 통화 화면 관련
  규정은 "확정된 동작" 6번의 "통화 화면에는 통화 시간, 음소거, 통화 종료,
  스피커 제어와 AI 발화 실시간 자막을 제공한다"와 "구현 규칙"의 "화면" 절
  (진입점 `F-1`~`F-3`, 표시할 결과)이 전부이며, 화면 이탈 경로는 규정하지
  않는다.
- `AC-002`의 `When`은 "AI가 발화하고 사용자가 음소거·스피커·종료 제어를
  사용한다"이지만 `Then`은 자막과 transcript 결과만 규정하고 제어 조작이나
  화면 이탈의 결과를 규정하지 않는다.
- 종료는 상태·API 수준으로만 규정되어 있다. "확정된 동작" 13번이
  `termination_type`과 상태 전이(`CONNECTING`+`USER_REQUESTED` → `CANCELLED`,
  `IN_PROGRESS`+`USER_REQUESTED` → `COMPLETED`)를 정하지만, 어떤 사용자 조작이
  `USER_REQUESTED`를 발생시키는지는 정하지 않는다.
- `docs/specs/UI_AND_NAVIGATION.md`의 뒤로 가기 규정은 B-3 → A-10 복귀와
  피보호자 관심사 설정의 J-1 복귀뿐이며, 두 곳 모두 AI 전화와 무관하다.
  Android 시스템(하드웨어) 뒤로 가기 공통 규칙 자체가 아직 공식 스펙에 없다.
- 결과적으로 통화 중 시스템 뒤로 가기의 목표 동작을 판정할 공식 기준이 없다.

## 제안 내용

`docs/specs/domains/AI_CALL.md`에 통화 화면의 시스템 뒤로 가기 동작을 추가한다.

1. 통화 화면(`F-2`, 연결 중·통화 중·종료 중)에서는 Android 시스템 뒤로 가기를
   소비하고 현재 화면을 유지한다. 통화 상태와 화면은 변하지 않는다.
2. 통화 종료는 화면의 `통화 종료` 제어로만 요청한다. 시스템 뒤로 가기는
   `USER_REQUESTED` 종료를 발생시키지 않는다.
3. 종료 결과 화면과 실패 화면에서는 시스템 뒤로 가기로 페르소나 선택 화면
   (`F-1`)으로 돌아간다. 단, 종료 요청 실패로 재시도가 필요한 실패 화면에서는
   기존 규칙대로 선택 화면 복귀를 막고 뒤로 가기를 소비한다.
4. 페르소나 선택 화면(`F-1`)의 시스템 뒤로 가기는 AI 전화 도메인이 규정하지
   않고 앱 전역 하단 탭 규칙을 따른다.

`AC-002`와 별개로, 통화 중 이탈 방지를 검증할 인수 조건을 추가한다.

- Given: 통화가 `CONNECTING` 또는 `IN_PROGRESS`다.
- When: 사용자가 Android 시스템 뒤로 가기를 누른다.
- Then: 통화가 종료되지 않고 통화 화면이 유지되며, 종료 API 요청이 발생하지
  않는다.

## 변경 근거

- QA에서 통화 중 시스템 뒤로 가기로 통화가 즉시 종료되는 결함이 확인되었다.
  Jira `S15P11B104-364` "AI 전화 중 시스템 뒤로가기 종료 방지"이며, 완료 기준은
  "통화 중 시스템 뒤로가기 키만으로 전화가 종료되지 않는다"이다.
- 수정 전 구현은
  `frontend/android/app/src/main/java/com/s15p11b104app/aicall/AiCallContent.kt`의
  `BackHandler`에서 `Connecting`·`InProgress`를 `finishCall()`에 연결해,
  뒤로 가기 한 번으로 되돌릴 수 없는 통화 종료가 실행되었다. 주 사용자가
  피보호자(고령 사용자)인 화면이라 오조작 위험이 크다.
- 통화 화면에서 사용자가 갇히지 않는 것은 확인했다. 같은 파일의 통화 종료
  버튼은 `enabled = !isEnding`이라 연결 중에도 활성이므로, 연결이 아무리
  지연되어도 버튼으로 취소할 수 있다. 연결 대기도 무한하지 않다.
  `AiCallWebRtc.kt`의 `awaitConnected`는 20초로 제한되고, 그 앞 단계의 HTTP
  호출은 `AiCallApi.kt`의 OkHttp 기본값(connect 15초, read 30초, write 30초)으로
  제한된다. 다만 이 값들은 순차로 누적되므로 연결 중 체류 시간의 상한이 20초는
  아니다.
- 시스템 뒤로 가기가 JS 계층으로 새지 않는 것도 확인했다. 통화 중에는
  `onFullscreenChange(true)`가 올라가 `frontend/src/app-shell/AppShell.tsx`의
  셸 뒤로 가기 훅이 `enabled = canReturnToFeed && !isScreenFullscreen`으로
  비활성화되며, Compose `BackHandler`는 활성 상태에서 이벤트를 소비한다.
- 일반 전화 앱이 통화 중 뒤로 가기로 통화를 끊지 않는 관례와 일치한다.
- 구현과 검증은 이번 작업에서 완료했다. 판정 로직을 `AiCallModels.kt`의
  `aiCallBackAction`으로 분리하고
  `frontend/android/app/src/test/java/com/s15p11b104app/aicall/AiCallModelsTest.kt`에
  단위 테스트 3건을 추가했다. `:app:testDebugUnitTest` 52건 전부 통과했다.

## 확인된 영향

- 영향 도메인: `AI_CALL`. 다른 도메인의 화면 전환 규칙은 바꾸지 않는다.
- 영향 계약: 없음. `API-CALLS-001`~`API-CALLS-003`, 데이터 모델, 인증·권한은
  변하지 않는다. 종료 API의 호출 주체가 화면 버튼으로 한정될 뿐 요청·응답
  형식과 상태 전이는 그대로다.
- 영향 화면: IA `F-2` 통화 화면과 `F-3` 결과 화면. `F-1` 선택 화면은 동작이
  바뀌지 않는다.
- 검증 범위: Android JVM 단위 테스트(`:app:testDebugUnitTest`), Kotlin 컴파일,
  에뮬레이터 수동 확인(피보호자 계정). 통화 중 뒤로 가기 무시, 종료 버튼 정상
  동작, 결과 화면 복귀를 함께 확인한다.
- 자동 검증 공백: 단위 테스트는 판정 함수 `aiCallBackAction`만 덮는다.
  `AiCallRoute`의 `BackHandler` 배선과 `enabled` 조건, 그리고 위 인수 조건의
  "종료 API 요청이 발생하지 않는다"는 자동 검증되지 않는다. `AiCallRoute`가
  `apiBaseUrl`과 토큰 제공자를 요구해 통화 단계까지 도달하는 계측 테스트를
  세우려면 의존성 주입 지점을 먼저 만들어야 한다. 현재는 에뮬레이터 수동
  확인으로만 덮는다.
- 커버리지 갱신 후보: `docs/specs/COVERAGE.md`의 AI 전화 관련 행. 확인 필요.

## 확인이 필요한 질문

- 인수 조건 번호는 반영 시점에 결정한다. 현재 공식 스펙은 `AC-010`까지 있고,
  `CHG-S15P11B104-370-ai-call-barge-in-suppression.md`도 같은 방식으로 번호를
  유보한 채 인수 조건 추가를 제안 중이므로, 두 제안의 반영 순서에 따라 번호가
  달라진다.
- `CHG-S15P11B104-270`과의 관계 확인 필요. 270의 공통 규칙 3번은 "저장·삭제·
  처리가 진행 중인 동안에는 소비하고 현재 화면을 유지한다"로, 짧게 끝나는 처리
  중 상태를 전제한다. 통화는 사용자가 종료할 때까지 지속되는 활동이라 3번의
  범위에 자연히 포함되지 않는다. 이 제안을 `AI_CALL` 도메인 예외로 둘지,
  270의 공통 규칙에 "지속되는 전체화면 활동" 항목을 추가해 흡수할지 결정이
  필요하다.
- `CHG-S15P11B104-310-call-control-default-state.md`와의 정리 확인 필요. 310은
  종료 중(`Ending`) 단계의 뒤로 가기 소비를 구현 사실로만 언급하고 규정하지
  않는다. 이 제안이 승인되면 310의 해당 서술은 이 제안을 참조하도록 정리하는
  편이 중복이 없다.
- 통화 중 뒤로 가기에 "통화를 종료할까요?" 확인창을 제공할지 확인 필요. 이번
  작업에서는 사용자 결정에 따라 확인창 없이 완전히 소비하도록 구현했다.
  `CHG-S15P11B104-270`의 미저장 변경 확인창 기준과 함께 정하면 일관된다.
- 제안 내용 3번의 예외(종료 재시도 실패 화면에서 뒤로 가기 소비)를 확정하기
  전에 막다른 길 조합을 먼저 해소해야 하는지 확인 필요. `AiCallContent.kt`에서
  `phase`와 `failureReason`은 `rememberSaveable`이지만 `failedEndPhase`는
  `remember`다. Activity가 재생성되어 `Failed` + `EndRequest`만 복원되고
  `failedEndPhase`가 `null`이 되면 "다시 시도"가 no-op, "다른 상대 선택"은
  숨김, 뒤로 가기는 소비가 되어 화면을 벗어날 수단이 없다. 이번 변경 이전에도
  같은 동작이었으므로 이 작업의 결함은 아니지만, 규정으로 승격하면 공식
  기준이 되므로 별도 티켓으로 처리할지 결정이 필요하다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
