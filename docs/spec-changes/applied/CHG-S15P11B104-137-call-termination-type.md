# AI 통화 종료 원인 전달 계약 추가

- 상태: 승인·반영 완료
- 제안자: Codex
- 작성일: 2026-07-29
- 차단 변경: 예
- 영향 스펙·계약: `AI_CALL`, `API-CALLS-003`
- 관련 작업: `S15P11B104-137`

## 기존 내용

`docs/specs/domains/AI_CALL.md`의 확정 동작 13과 구현 규칙은 연결 전 종료를
`CANCELLED`, 연결 실패를 `FAILED`, 통화 중 정상 종료를 `COMPLETED`, 통화 중
종료 요청 없는 연결 단절을 `INCOMPLETE`로 구분한다.

`docs/specs/contracts/API.md`의 `API-CALLS-003`은
`POST /call-sessions/{callSessionId}/end` 요청 body가 없으며, `CONNECTING`은
`CANCELLED`, `IN_PROGRESS`는 `COMPLETED`로 전이하도록 정한다. 따라서 현재
클라이언트는 사용자 종료와 감지된 WebRTC 연결 단절을 이 API 요청에서 구분해
전달할 수 없다.

## 제안 내용

`API-CALLS-003` 요청에 선택적인 `termination_type`을 추가한다.

- 허용값은 `USER_REQUESTED`, `CONNECTION_LOST`다.
- 요청 body 또는 `termination_type`이 없으면 기존 클라이언트 호환을 위해
  `USER_REQUESTED`로 처리한다.
- 알 수 없는 값은 `400 INVALID_REQUEST`로 처리한다.
- `USER_REQUESTED`는 `CONNECTING -> CANCELLED`,
  `IN_PROGRESS -> COMPLETED`로 전이한다.
- `CONNECTION_LOST`는 `CONNECTING -> FAILED`,
  `IN_PROGRESS -> INCOMPLETE`로 전이한다.
- WebRTC가 통화 중 `failed` 또는 `disconnected`가 되면 클라이언트는 복구
  대기 없이 `CONNECTION_LOST`를 전달한다.
- 클라이언트와 Sideband가 같은 단절을 함께 보고하면 DB 행 잠금으로 먼저
  확정된 종결 상태를 보존하고, 이후 종료 요청은 상태를 다시 변경하지 않은 채
  동일한 성공 응답을 반환한다.
- 프론트 요청이 불가능한 앱·브라우저·네트워크 강제 종료는 기존 Sideband
  `onClose`·`onError` 감지를 유지해 보완한다.

성공 응답의 HTTP 상태와 응답 body는 기존 `202`, `call_session_id`를 유지한다.
`call_sessions`에는 종료 원인을 새 컬럼으로 저장하지 않는다.

## 변경 근거

`backend/src/main/resources/static/ai-call/app.js`의 `endAfterConnectionLoss()`는
통화 중 WebRTC 단절을 감지해도 사용자 종료와 동일한 `/end` 요청을 보낸다.
`backend/src/main/java/com/ssafy/s15p11b104/domain/call/service/CallSessionService.java`
는 해당 요청을 항상 `endByUser()`로 처리하므로 `IN_PROGRESS` 단절이
`COMPLETED`로 기록될 수 있다.

사용자가 승인한 구현 계획은 사용자 종료와 연결 단절을 명시적으로 구분하고,
현재 MVP에서는 `disconnected`도 즉시 비정상 종료로 확정하도록 정했다.

## 확인된 영향

- 영향 도메인: AI 통화 종료와 상태 전이
- 영향 계약: `API-CALLS-003` 요청 body와 중복 종료의 성공 처리
- 영향 화면: AI 통화 화면의 WebRTC 단절 처리
- 검증 범위: 기존 body 없는 종료 요청 호환, 종료 원인별 상태 전이, 잘못된
  enum 검증, 브라우저·Sideband 중복 보고, 프론트 WebRTC 상태 처리

## 결정 및 반영

- 결정: 승인(전체)
- 결정자: 사용자
- 결정일: 2026-07-29
- 반영 문서: `docs/specs/domains/AI_CALL.md`, `docs/specs/contracts/API.md`
- 반영 커밋:
