# 최신 Notion 기준 로컬 스펙 전수 동기화

- 상태: 반영 완료
- 제안자: unknown
- 작성일: 2026-07-27
- 차단 변경: 예
- 영향 스펙·계약: `README`, `COMMON`, `INDEX`, `COVERAGE`,
  `UI_AND_NAVIGATION`, `API`, `DATA_MODEL`, 전체 도메인 스펙
- 관련 작업: 사용자 요청 — 수정된 Notion을 기준으로 로컬 스펙 수정

## 기존 내용

- 로컬 스펙은 Spring Boot와 FastAPI가 업무를 나눠 처리하고, FastAPI가
  `post_analyses`, 통화·전사·리포트 테이블을 직접 쓴다고 기록했다.
- 모바일 기술 경계는 `RN+Kotlin`으로만 표현돼 Kotlin 적용 범위가 AI
  전화로 한정된다는 사실이 불명확했다.
- 일일 리포트 22시 실행과 DB·로그·API timestamp의 시간 기준이 분리되어
  있지 않았다.
- 회원가입·로그인 문서 일부의 과거 출처에는 이메일 인증과 이메일 로그인이
  남아 있었고, 현행 비지원 경계가 전체 계약에 명확히 연결되지 않았다.
- API 계약은 구 그룹·관심사 ID, 분리된 가입 승인·거절 API,
  `POST /groups/{groupId}/leave`, `guardianMessages[]`를 기록했다.
- `API-POSTS-006`을 활성 FastAPI 내부 API로 취급했다.
- 데이터 계약은 최신 ERD와 다음 부분이 달랐다.
  - `JOIN_REQUEST_STATUS`에 `CANCELLED`가 있었다.
  - `post_analyses.status`가 `VARCHAR(20)`이었다.
  - 건별·일일 `guardian_message`가 `TEXT`였다.
  - `carnations.group_id`가 없었다.
  - `notifications.title`, `body`가 길이 제한 `VARCHAR`였다.
  - 알림 설정 최초 기본값이 미결정이었다.

## 승인·반영 내용

### 1. Spring Boot 단일 백엔드

- 별도 FastAPI 서버를 제거한다.
- 활성 서비스 API 59건, 인증·인가, AI 오케스트레이션과 모든 DB
  읽기·쓰기를 Spring Boot가 담당한다.
- 게시글 분석은 Spring Scheduler가 10분 안정화 대상을 찾고 내부
  `PostAnalysisService`가 Gemini를 호출해 결과를 저장한다.
- Spring Boot가 OpenAI Realtime SDP 교환과 Sideband WebSocket,
  Tool Calling, 완료 전사, 통화 상태와 Gemini 리포트 생성을 처리한다.
- AI 음성 미디어는 Kotlin 모듈과 OpenAI Realtime이 WebRTC로 직접
  주고받는다.

### 2. 모바일 기술 경계

- AI 전화 화면과 통화 엔진만 Android Kotlin 네이티브 모듈로 구현한다.
- AI 전화를 제외한 모든 모바일 화면과 기능은 React Native로 구현한다.
- React Native와 Kotlin의 브리지는 AI 전화 경계에서만 사용한다.

### 3. 인증과 시간 기준

- 회원가입과 로그인은 `loginId`와 비밀번호를 사용한다.
- 이메일 회원가입·로그인·인증은 지원하지 않는다.
- 일일 리포트는 Spring Scheduler가 `Asia/Seoul` 기준 매일 22시에
  실행한다.
- DB 시각 컬럼은 `TIMESTAMPTZ`를 사용하고 DB 저장·서버 로그·API
  timestamp는 UTC 절대 시각으로 관리한다.
- 사용자 화면, 상대 날짜 해석과 비즈니스 스케줄에만 `Asia/Seoul`을
  적용한다.

### 4. API 계약

- API 명세서 레코드 60건을 활성 API 59건과 폐기 1건으로 구분한다.
- 그룹은 `API-GROUPS-001~015`, 관심사는
  `API-INTERESTS-001~002`로 다시 매핑한다.
- 가입 승인·거절은
  `PATCH /groups/{groupId}/join-requests/{joinRequestId}` 단일 경로로
  통합한다.
- 그룹 나가기는 `DELETE /groups/{groupId}/leave`를 사용한다.
- `API-GROUPS-015` 구성원 프로필 응답은 `memberId`, 조회자 기준
  `displayName`, 만 나이 `age`, `gender`다.
- 관심사는 빈 배열을 포함해 0~10개를 허용하고, 각 값은 trim 후
  1~10자이며 중복을 제거해 전체 교체한다.
- 일일 리포트는 nullable 단일 `guardianMessageSummary`를 제공하고
  `guardianMessages[]`는 제공하지 않는다.
- 폐기된 `API-POSTS-006`은 HTTP API로 구현하지 않는다.

### 5. 데이터 계약

- 21개 테이블의 모든 읽기·쓰기를 Spring Boot 소유로 통일한다.
- 모든 시각 컬럼을 `TIMESTAMPTZ`·UTC 저장 기준으로 명시한다.
- `JOIN_REQUEST_STATUS`는 `PENDING_ADMIN`, `APPROVED`,
  `REJECTED`만 사용한다.
- `ANALYSIS_STATUS`를 `PENDING`, `SUCCESS`, `FAILED`로 정의하고
  `post_analyses.status`에 사용한다.
- `call_reports.guardian_message`는 `VARCHAR(100) NULL`,
  `daily_reports.guardian_message`는 `VARCHAR(200) NULL`이다.
- `carnations`에 `group_id -> family_groups.id`와
  `(group_id, earned_date)` 인덱스를 반영한다.
- `notifications.title`, `notifications.body`는 `TEXT`다.
- `notification_settings.is_enabled`의 최초 기본값은 `true`다.

### 6. 원본 우선순위와 미결정 보존

- 2026-07-28 최종 기술 결정·현행 AI 설계·API·ERD가 같은 주제의 이전
  요구사항·기능 명세에 남은 FastAPI 문구를 대체한다.
- 다음 충돌은 어느 한쪽을 임의 선택하지 않고 공식 스펙의 미결정으로
  유지한다.
  - `API-GROUPS-009`: `status=APPROVED` 또는
    `decision=APPROVE|REJECT`
  - 인물 게시글 Tool: `person_key` 또는 `person_query`
  - 일정 Tool: `date_expression` 또는 `target_date`
  - 22시 이후 통화의 `report_date`

## 변경 근거

- 서비스 루트:
  https://app.notion.com/p/a07e66fae192822d8862011c73e2305e
- 기술 스택:
  https://app.notion.com/p/3a9e66fae1928130bb4ee5f41f03655e
- Spring Boot 단일 백엔드 최종 결정:
  https://app.notion.com/p/d6ce66fae192824a90b401ed43e677be
- API 명세서 2차 수정본:
  https://app.notion.com/p/3a9e66fae19280f59e4df42a241b0934?v=fafe66fae192830bb03a086ca40b4e7a
- 최신 ERD:
  https://app.notion.com/p/2aee66fae192821c8c8101ef1ede4025
- AI 게시글 분석:
  https://app.notion.com/p/3a9e66fae19280aaacbecafe26ea7104
- AI 요약 리포트:
  https://app.notion.com/p/3a9e66fae19280b4a1f2d360d5710526
- AI 통화 상세:
  https://app.notion.com/p/3a9e66fae1928039986cf4393a377c92
- AI 통화 Tool Calling:
  https://app.notion.com/p/3a9e66fae1928056b518f3a4cef4251e

## 확인된 영향

- 영향 도메인: 계정, 그룹, 피드, AI 통화, 리포트, 일정, 알림,
  카네이션·랭킹
- 영향 계약: 활성 API ID·Method·Path·요청·응답, 데이터 소유권,
  DB 필드·Enum·타입, 모바일 구현 경계, 시간 기준
- 영향 화면: AI 전화만 Kotlin, 나머지 모바일 화면은 React Native
- 코드·테스트·빌드 설정은 변경하지 않는다.

## 확인이 필요한 질문

- `API-GROUPS-009` 판별 필드는 후속 승인 제안
  [`CHG-20260727-unknown-group-join-request-decision-field.md`](./CHG-20260727-unknown-group-join-request-decision-field.md)에 따라
  `decision=APPROVE|REJECT`로 확정됐다.
- Tool 입력 필드는 후속 승인 제안
  [`CHG-20260728-unknown-notion-ai-final-sync.md`](./CHG-20260728-unknown-notion-ai-final-sync.md)에 따라
  `person_key`와 `date_expression`으로 확정됐다. 22시 이후 통화의
  `report_date`만 미결정으로 유지한다.

## 결정 및 반영

- 결정: 최신 수정 Notion을 공식 로컬 스펙에 반영하되, 원본 내부 충돌은
  미결정으로 보존
- 결정자: 사용자
- 결정일: 2026-07-28
- 반영 문서: `docs/specs/README.md`, `COMMON.md`, `INDEX.md`,
  `COVERAGE.md`, `UI_AND_NAVIGATION.md`, `contracts/API.md`,
  `contracts/DATA_MODEL.md`, `domains/*.md`
- 반영 커밋:
