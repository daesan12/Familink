# API-GROUPS-009 가입 요청 처리 판별 필드 확정

- 상태: 제안
- 제안자: unknown
- 작성일: 2026-07-27
- 차단 변경: 예
- 영향 스펙·계약: `API-GROUPS-009`, `GROUPS_AND_MEMBERSHIP`, 가입 요청 DTO·테스트
- 관련 작업: 활성 API·로컬 스펙 동기화 중 발견한 원본 내부 충돌

## 기존 내용

활성 API의 `API-GROUPS-009`
`PATCH /groups/{groupId}/join-requests/{joinRequestId}` 페이지 안에 서로 다른
요청 계약이 함께 있다.

- 요청 Body 예시는 다음처럼 `status`를 사용한다.

  ```json
  {
    "assignedRole": "CARE_RECEIVER",
    "status": "APPROVED"
  }
  ```

- 같은 페이지의 오류·처리 규칙·입력 제약은 다음처럼 `decision`을 사용한다.
  - `decision = APPROVE | REJECT`
  - `decision = APPROVE`일 때 `assignedRole` 필수
  - `decision = REJECT`일 때 `assignedRole` 생략 또는 `null`
  - 오류 코드 `INVALID_JOIN_REQUEST_DECISION`

현재 로컬 API 계약은 이전 분리 경로인 승인 API와 거절 API를 각각 기록하고
있어, 통합 경로의 판별 필드를 구현 기준으로 제공하지 못한다.

## 제안 내용

다음 두 대안 중 하나를 명시적으로 선택해 활성 API 원본과 로컬 계약을 함께
통일한다.

### 대안 A — `decision` 사용

```json
{
  "decision": "APPROVE",
  "assignedRole": "CARE_RECEIVER"
}
```

- 허용값: `APPROVE`, `REJECT`
- `APPROVE`일 때만 `assignedRole` 필수
- `REJECT`일 때 `assignedRole` 생략 또는 `null`
- 기존 오류 코드 `INVALID_JOIN_REQUEST_DECISION`과 의미가 일치한다.
- 응답의 저장 결과 상태는 `APPROVED` 또는 `REJECTED`를 사용한다.

### 대안 B — `status` 사용

```json
{
  "status": "APPROVED",
  "assignedRole": "CARE_RECEIVER"
}
```

- 허용값: `APPROVED`, `REJECTED`
- `APPROVED`일 때만 `assignedRole` 필수
- `REJECTED`일 때 `assignedRole` 생략 또는 `null`
- 오류 코드와 처리 규칙의 `decision` 표현을 `status` 기준으로 함께
  수정해야 한다.

선택 전까지 로컬 `API-GROUPS-009`에는 Method·Path·권한·성공 결과·명시
오류만 반영하고, 요청 판별 필드명과 허용값은 `미결정`으로 유지한다.

## 변경 근거

- 활성 API 페이지:
  https://app.notion.com/p/ba7e66fae192838582b68126bbbb3b33
- 2026-07-27 재조회한 동일 페이지의 Body 예시와
  오류·처리 규칙·입력 제약이 서로 충돌한다.
- API·프론트·백엔드가 함께 의존하는 요청 DTO이므로 한쪽을 추측해
  확정하면 호환되지 않는 구현이 생긴다.

## 확인된 영향

- 영향 도메인: 그룹 가입 요청 승인·거절
- 영향 계약: `API-GROUPS-009` 요청 Body와 검증 오류
- 영향 화면: `H-5p` 가입 요청 처리
- 검증 범위: 활성 API 페이지 본문·속성, 로컬 API 계약, 프론트 요청 DTO,
  Spring Boot 요청 DTO와 승인·거절 테스트

## 확인이 필요한 질문

1. 요청 판별 필드는 `decision`과 `status` 중 어느 이름을 사용합니까?
2. 허용값은 `APPROVE`·`REJECT`와 `APPROVED`·`REJECTED` 중 어느 쌍을
   사용합니까?

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
