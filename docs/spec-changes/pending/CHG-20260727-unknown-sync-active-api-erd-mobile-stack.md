# 활성 API·ERD·모바일 기술 경계 로컬 스펙 동기화

- 상태: 제안
- 제안자: unknown
- 작성일: 2026-07-27
- 차단 변경: 예
- 영향 스펙·계약: `COMMON`, `INDEX`, `API`, `DATA_MODEL`, `ACCOUNT_AND_PROFILE`, `GROUPS_AND_MEMBERSHIP`, `AI_CALL`, `REPORTS`, `COVERAGE`
- 관련 작업: 사용자 요청 — 활성 API·최신 ERD 기준 로컬 스펙 불일치 분석 및 업데이트

## 기존 내용

- [`docs/specs/contracts/API.md`](../../specs/contracts/API.md)는 활성 API와
  같은 60건을 표방하지만 그룹 API를 `API-GROUPS-005~017`, 관심사 API를
  `API-INTERESTS-002~003`으로 기록한다.
  - 활성 API에는 그룹 API `API-GROUPS-001~015`, 관심사 API
    `API-INTERESTS-001~002`만 있다.
  - 로컬에는 분리된 가입 승인·거절 경로와 `POST /groups/{groupId}/leave`가
    남아 있다.
  - 활성 API는 단일 가입 요청 처리 경로와
    `DELETE /groups/{groupId}/leave`를 사용한다.
  - 활성 API의 `API-GROUPS-015` 구성원 프로필 조회가 로컬 API 계약에 없다.
- 로컬 `API-REPORTS-002`는 일일 리포트 응답에 `guardianMessages[]`가 있다고
  기록하지만, 활성 API는 nullable `guardianMessageSummary`를 반환하고
  `guardianMessages`를 포함하지 않는다고 명시한다.
- [`docs/specs/contracts/DATA_MODEL.md`](../../specs/contracts/DATA_MODEL.md)는
  최신 ERD와 다음 부분이 다르다.
  - `JOIN_REQUEST_STATUS`에 최신 ERD에 없는 `CANCELLED`가 있다.
  - `call_reports.guardian_message`와
    `daily_reports.guardian_message`를 `TEXT`로 기록한다.
  - `carnations.group_id`를 누락한다.
  - `notifications.title`, `notifications.body`를 각각
    `VARCHAR(100)`, `VARCHAR(300)`으로 기록한다.
- [`docs/specs/domains/ACCOUNT_AND_PROFILE.md`](../../specs/domains/ACCOUNT_AND_PROFILE.md)는
  관심사 최소 개수와 그룹 구성원 프로필 공개 범위를 미결정으로 남긴다.
  활성 API는 관심사 빈 배열과 0~10개 저장을 허용하고, 구성원 프로필
  응답을 `memberId`, `displayName`, `age`, `gender`로 제한한다.
- [`docs/specs/COMMON.md`](../../specs/COMMON.md)와
  [`docs/specs/domains/AI_CALL.md`](../../specs/domains/AI_CALL.md)는
  `RN+Kotlin 클라이언트` 또는 `React Native와 Android Kotlin 브리지`로만
  표현해 Kotlin 적용 범위를 AI 전화로 한정한다는 확정 경계가 불명확하다.
- [`docs/specs/COVERAGE.md`](../../specs/COVERAGE.md)는 위 구 API ID와
  `guardianMessages[]` 매핑 충돌, 관심사 최소 개수 미결정을 현행 상태로
  기록한다.

## 제안 내용

### 1. 활성 API 60건 기준으로 API 계약을 다시 매핑한다

- `API-GROUPS-001~003`은 현행 내용을 유지한다.
- 다음 활성 그룹 API를 API ID 기준으로 기록한다.
  - `API-GROUPS-004` `GET /groups/{groupId}` — 그룹 상세 조회
  - `API-GROUPS-005` `GET /groups/{groupId}/members` — 구성원 목록 조회
  - `API-GROUPS-006` `PATCH /groups/{groupId}` — 그룹명 수정
  - `API-GROUPS-007` `GET /groups/{groupId}/invite-code` — 초대 코드 조회
  - `API-GROUPS-008` `GET /groups/{groupId}/join-requests` — 가입 요청 목록
  - `API-GROUPS-009` `PATCH /groups/{groupId}/join-requests/{joinRequestId}` —
    가입 요청 처리
  - `API-GROUPS-010` `PATCH /groups/{groupId}/members/{memberId}/role` —
    구성원 역할 변경
  - `API-GROUPS-011` `PATCH /groups/{groupId}/manager` — 관리자 변경
  - `API-GROUPS-012` `DELETE /groups/{groupId}/members/{memberId}` —
    구성원 내보내기
  - `API-GROUPS-013` `DELETE /groups/{groupId}/leave` — 그룹 나가기
  - `API-GROUPS-014` `DELETE /groups/{groupId}` — 그룹 삭제
  - `API-GROUPS-015` `GET /groups/{groupId}/members/{memberId}` —
    구성원 프로필 조회
- 로컬의 `API-GROUPS-016`, `API-GROUPS-017` 행은 제거한다.
- 관심사는 `API-INTERESTS-001` 조회와 `API-INTERESTS-002` 일괄 수정으로
  다시 매핑하고 `API-INTERESTS-003`을 제거한다.
- `API-GROUPS-009`의 Method·Path·권한·성공 결과·명시 오류는 반영하되,
  요청 판별 필드명은 별도 변경 제안이 결정되기 전까지 계약상 미결정으로
  표시한다.
- `API-REPORTS-002.dailyReport`에는
  `guardianMessageSummary: string | null`을 기록하고,
  `guardianMessages[]`는 응답에서 제거한다.
- `API-REPORTS-002.guardianMessageSummary`는
  `daily_reports.guardian_message`에 저장된 최대 200자의 일일 대표
  보호자 메모이며 전달사항이 없으면 `null`이다.

### 2. 최신 ERD 기준으로 데이터 계약을 고친다

- `JOIN_REQUEST_STATUS`는 `PENDING_ADMIN`, `APPROVED`, `REJECTED`만 사용한다.
- `call_reports.guardian_message`는 `VARCHAR(100) NULL`로 기록한다.
- `daily_reports.guardian_message`는 `VARCHAR(200) NULL`로 기록한다.
- `carnations`에 `group_id BIGINT NOT NULL -> family_groups.id`를 추가한다.
- `notifications.title`, `notifications.body`는 `TEXT NOT NULL`로 기록한다.
- 일일 보호자 메모의 저장·응답 매핑은
  `daily_reports.guardian_message` ↔ `guardianMessageSummary`로 확정되어
  있으므로 기존 미결정 항목에서 제거한다.

### 3. 도메인 스펙을 계약에 맞춘다

- `GROUPS_AND_MEMBERSHIP`
  - 가입 요청 상태에서 `CANCELLED`를 제거한다.
  - 그룹 API 참조 범위를 `API-GROUPS-001~015`로 바꾼다.
  - 같은 그룹 활성 구성원의 축소 프로필
    (`memberId`, `displayName`, `age`, `gender`) 조회 동작을 추가한다.
- `ACCOUNT_AND_PROFILE`
  - 관심사는 빈 배열을 포함해 0~10개를 허용하고 각 값은 trim 후
    1~10자, 중복 제거 기준으로 전체 교체한다고 기록한다.
  - API 참조를 `API-INTERESTS-001~002`로 바꾼다.
  - 관심사 최소 입력 개수와 그룹 구성원 프로필 공개 필드의 미결정 표시를
    제거한다. 프로필 팝업의 시각·상호작용 세부만 미결정으로 남긴다.
- `REPORTS`
  - 건당 보호자 전달 메모는 최대 100자 nullable로 기록한다.
  - 일일 리포트는 최대 200자 nullable `guardianMessageSummary`를 제공하고
    건당 메모 배열은 제공하지 않는다고 기록한다.
  - 단일 저장 필드와 배열 응답의 기존 미결정 항목을 제거한다.

### 4. 모바일 기술 경계를 명시한다

- 모바일 앱의 AI 전화 영역만 Kotlin(Android) 네이티브 모듈로 구현한다.
- AI 전화를 제외한 모바일 앱 화면과 기능은 React Native로 구현한다.
- Kotlin 모듈과 React Native 사이의 브리지는 AI 전화 경계에서만 사용한다.
- `COMMON`, `AI_CALL`, `INDEX`, `COVERAGE`의 `RN+Kotlin` 축약 표현을 위
  문장으로 바꾼다.

### 5. COVERAGE를 실제 현행 매핑으로 갱신한다

- API 원본 수와 반영 수는 60건으로 유지하되 그룹·관심사 API 행을 현행
  ID로 교체한다.
- `API-GROUPS-015` 구성원 프로필 조회를 추가하고 구 `016`, `017`,
  `API-INTERESTS-003` 매핑을 제거한다.
- `API-REPORTS-002`, `call_reports`, `daily_reports`, `carnations`,
  `notifications`, `JOIN_REQUEST_STATUS`의 반영 근거를 최신 상태로 고친다.
- 관심사 0~10개와 `guardianMessageSummary`가 API 우선 기준으로 확정됐음을
  반영하고 기존 미결정 항목에서 제거한다.
- `API-GROUPS-009` 요청 판별 필드 충돌은 별도 미결정 항목으로 연결한다.

## 변경 근거

- 활성 API 뷰:
  https://app.notion.com/p/3a9e66fae19280f59e4df42a241b0934?v=fafe66fae192830bb03a086ca40b4e7a
  - 2026-07-27 재조회 결과 활성 60건.
  - 로컬 API 60행과 API ID를 기본 키로 비교했을 때 Method·Path가 정확히
    일치한 활성 행은 46건이고, 그룹 12건과 관심사 2건이 불일치했다.
- 최신 ERD:
  https://app.notion.com/p/2aee66fae192821c8c8101ef1ede4025
  - `7/27 ( 신 ) ERD 코드 4차`와 확정 테이블·Enum 문서를 기준으로
    21개 테이블, 148개 필드, 9개 Enum을 확인했다.
- 일일 통화 리포트 API:
  https://app.notion.com/p/b5ee66fae19283b8b13d0125ebc92f09
  - `guardianMessageSummary`를 반환하고 `guardianMessages`는 포함하지
    않는다고 명시한다.
- 기술 스택 문서:
  https://app.notion.com/p/3a9e66fae1928130bb4ee5f41f03655e
  - AI 전화 영역은 Kotlin 네이티브 모듈, 그 외 모바일 화면·기능은
    React Native로 확정한다.
- 기술 결정:
  https://app.notion.com/p/d6ce66fae192824a90b401ed43e677be

## 확인된 영향

- 영향 도메인: 계정·관심사, 그룹·가입·구성원, AI 통화, 통화·일일 리포트
- 영향 계약: API ID·Method·Path·요청·응답·오류, DB 필드·Enum·타입,
  모바일 구현 경계
- 영향 화면: 기존 `H-1p` 구성원 프로필, `J-3`·`J-4` 관심사 화면의
  데이터 계약. 화면 이동 자체는 변경하지 않는다.
- 검증 범위:
  - 활성 API 60건의 API ID·Method·Path 전수 비교
  - 최신 ERD 21개 테이블·148개 필드·9개 Enum 대조
  - 수정 문서 상호 링크와 `COVERAGE` 매핑
  - 공식 스펙 외 소스 코드·테스트·빌드 설정 무변경 확인

## 확인이 필요한 질문

- `API-GROUPS-009` 요청 판별 필드는
  [`CHG-20260727-unknown-group-join-request-decision-field.md`](./CHG-20260727-unknown-group-join-request-decision-field.md)
  결정 전까지 구현 기준으로 사용하지 않는다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
