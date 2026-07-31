# AI 통화 API 오류 조건 매핑 확정

- 상태: 승인·반영 완료
- 제안자: Codex
- 작성일: 2026-07-31
- 차단 변경: 예
- 영향 스펙·계약: `API-CALLS-001`, `API-CALLS-002`, `API-CALLS-003`
- 관련 작업: `S15P11B104-210` C2~C4
- 관련 제안: [`CHG-S15P11B104-114-common-response-envelope.md`](../pending/CHG-S15P11B104-114-common-response-envelope.md), [`CHG-S15P11B104-137-call-termination-type.md`](./CHG-S15P11B104-137-call-termination-type.md)

## 기존 내용

`docs/specs/contracts/API.md`는 세 통화 API의 상태 코드, 성공 `data` 필드와
허용 오류 코드 목록을 이미 정의한다. `docs/specs/domains/AI_CALL.md`와
적용 완료된 종료 원인 제안은 먼저 확정된 종결 상태를 보존하고 중복 종료도
동일한 `202` 성공으로 처리하며 리포트를 중복 생성하지 않는다고 정한다.

공통 실패 봉투는 `{success=false,code,message,errors}`로 확정되어 있다.
다만 통화 요청의 구체적인 실패 원인을 어떤 기존 오류 코드에 연결할지와
중복 종료에서 `409`를 사용하지 않는다는 경계는 한곳에 명시되어 있지 않다.

## 제안 내용

- 잘못된 JSON, 필수 필드 누락, enum 값 오류, SDP 또는 필드 검증 실패는
  `400 INVALID_REQUEST`다.
- Access Token 누락·만료·서명 실패는 `401 UNAUTHORIZED`다.
- 유효한 사용자지만 피보호자 역할 또는 해당 통화 당사자 권한이 없으면
  `403 FORBIDDEN`이다.
- 존재하지 않는 세션은 `API-CALLS-002`와 `API-CALLS-003`에서만
  `404 CALL_SESSION_NOT_FOUND`다.
- 이미 활성 통화가 있으면 `API-CALLS-001`에서만
  `409 ACTIVE_CALL_EXISTS`다.
- 연결 결과를 허용하지 않는 세션 상태면 `API-CALLS-002`에서만
  `409 INVALID_CALL_STATUS`다.
- OpenAI Realtime 연결 생성 또는 SDP 교환 실패는 `API-CALLS-001`에서만
  `502 AI_CONNECTION_FAILED`다.
- `API-CALLS-003`의 중복 종료는 오류가 아니다. 먼저 확정된 종결 상태와
  최초 `endedAt`을 보존하고 후속 종료 요청은 상태를 바꾸지 않은 채 같은
  `202` 성공을 반환한다. 마지막 전사 정리와 리포트 생성은 한 번만
  접수한다.
- `call_sessions`에 종료 원인을 저장하는 새 컬럼을 추가하지 않는다.

위 실패는 모두 공통 실패 봉투를 사용하고 새 오류 코드를 만들지 않는다.

## 변경하지 않는 기존 계약

- JSON 요청 필드는 `snake_case`를 유지한다.
- Path는 `/call-sessions/{callSessionId}` 형태를 유지한다.
- 클라이언트는 `groupId`, 서버가 관리하는 현재 세션 `status`, 내부
  사용자·멤버십 ID를 추가로 보내지 않는다. 계약 입력인 연결 결과
  `result`와 종료 원인 `termination_type`은 전달한다.
- 성공 상태와 `data`는 `API-CALLS-001`의 `201`
  `{call_session_id,sdp_answer}`, `API-CALLS-002`의 `200`
  `{call_session_id}`, `API-CALLS-003`의 `202` `{call_session_id}`를
  그대로 사용한다.
- 성공 봉투와 고정 문구는 관련
  `CHG-S15P11B104-114-common-response-envelope.md`에서 다룬다.
- 이 결정은 HTTP 상태와 오류 `code` 매핑만 고정한다. 별도로 확정되지 않은
  통화 오류의 정확한 `message` 문구는 미결정이며 클라이언트 분기 기준으로
  사용하지 않는다.

## 변경 근거

- 2026-07-31 사용자는 C1~C4를 권장안대로 결정했다.
- C2의 필드명·Path와 C3의 중복 종료 규칙은 이미 공식 스펙이므로 새 변경
  대상으로 만들지 않고 유지 범위로만 기록했다.
- C4는 공식 표에 있는 오류 코드를 재사용해 실패 원인별 매핑을 고정한다.
  중복 종료에 별도 `409`를 추가하면 이미 확정된 멱등 계약과 충돌한다.

## 확인된 영향

- 영향 도메인: AI 통화 생성·연결 결과·종료
- 영향 계약: `API-CALLS-001`~`API-CALLS-003`
- 영향 화면: 통화 연결·종료 실패 안내
- 검증 범위: 요청 검증, 인증·권한, 세션 존재·상태, AI 연결 실패,
  동시·반복 종료와 단일 리포트 접수

## 결정 및 반영

- 결정: 승인(전체). `S15P11B104-210`의 C2~C4를 제안 내용대로 반영하고,
  기존 성공 상태·데이터·Path·종료 원인 계약은 그대로 유지한다.
- 결정자: 사용자
- 결정일: 2026-07-31
- 반영 문서: `docs/specs/contracts/API.md`,
  `docs/specs/domains/AI_CALL.md`, `docs/specs/COVERAGE.md`
- 반영 커밋:
